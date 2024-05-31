// QuantumLandscapeChart.js

import React from 'react'
import * as d3 from 'd3'
import { saveAs } from 'file-saver'
import XMLSerializer from 'xmlserializer'
import '../viz-style.css'
import axios from 'axios'
import { sortByCounts } from './SortFunctions'
import config from '../config'

const fontType = 'Helvetica'
const smallLabelSize = 15 // font size in pixel
const mobileLabelSize = 11
const chartHeight = 180 // chart height,
const circleSize = 8
const strokeSize = '1.5px'
const circleOpacity = {
  fieldLegend: 0.7,
  achieved: 0.5,
  estimated: 0.1
}
const strokeOpacity = {
  fieldLegend: 0,
  achieved: 1,
  estimated: 0.7
}
const colors = ['#ED1010', '#0D99FF', '#56E1C8', '#FFB800']
const domainIndex = {
  quantinuum: 0,
  ibmq: 1,
  rigetti: 2,
  other: 3
}
const breakpoint = 700
let isMobile = window.outerWidth < breakpoint
let svg, d, metricName, taskName

let areLabelsVisible = false
function onLabelSwitchClick () {
  areLabelsVisible = !areLabelsVisible
  refreshLabels()
}
let areLabelsArxiv = false
function onArxivSwitchClick () {
  areLabelsArxiv = !areLabelsArxiv
  refreshLabels()
}
let isScaleLinear = false
function onScaleSwitchClick () {
  isScaleLinear = !isScaleLinear
  redraw()
}
function onMetricSelectChange (e) {
  metricName = e.target.value
  redraw()
}
function onDownloadClick () {
  const svgElement = d3.select('#my_dataviz').node()
  const svgString = new XMLSerializer().serializeToString(svgElement)
  const blob = new Blob([svgString], {
    type: 'image/svg+xml;charset=utf-8'
  })
  saveAs(blob, 'chart.svg')
}
function refreshLabels () {
  if (areLabelsVisible) {
    showLabels()
  } else {
    hideLabels()
  }
}

function showLabels () {
  [...document.getElementsByClassName('labeltohide')].forEach((el) => {
    el.style.visibility = 'visible'
  })
}

function hideLabels () {
  [...document.getElementsByClassName('labeltohide')].forEach((el) => {
    el.style.visibility = 'hidden'
  })
}

function barplot (
  data,
  xRange,
  yRange,
  Y,
  marginLeft,
  marginTop,
  yAxisText
) {
  const height = yRange[0] - yRange[1]
  const yMin = d3.min(Y)
  const yDomain = [yMin < 1 ? yMin : 1, d3.max(Y)]
  console.log(yDomain)
  console.log(yRange)
  const x = d3.scaleBand()
    .range([xRange[0], xRange[1]])
    .domain(data.map((i) => { if (i.arXiv && areLabelsArxiv) { return `arXiv:${i.arXiv}` } else { return i.platformName ? i.platformName : i.methodName } }))
    .padding(0.2)
  svg.append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'translate(-10,0)rotate(-45)')
    .style('text-anchor', 'end')

  // Add Y axis
  const y = (isScaleLinear ? d3.scaleLinear() : d3.scaleLog())
    .range([0, yRange[0] - yRange[1]])
    .domain([yDomain[1], yDomain[0]])

  const yAxis = d3.axisLeft(y)
  // append y axis
  svg
    .append('g')
    .attr('transform', `translate(${marginLeft},0)`)
    .attr('class', 'yaxis')
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .call(yAxis)
    .call((g) =>
      g
        .append('text')
        .attr('transform', 'rotate(270)')
        .attr('x', -marginTop)
        .attr('y', -50)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'end')
        .attr('font-size', `${smallLabelSize}px`)
        .text(yAxisText)
    )

  // Bars
  svg.selectAll('bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', (i) => { if (i.arXiv && areLabelsArxiv) { return x(`arXiv:${i.arXiv}`) } else { return x(i.platformName ? i.platformName : i.methodName) } })
    .attr('y', (i) => y(i.metricValue))
    .attr('width', x.bandwidth())
    .attr('height', (i) => (height - y(i.metricValue)))
    .style('stroke', (i) =>
      colors[domainIndex[i.provider]]
        ? colors[domainIndex[i.provider]]
        : colors[3]
    )
    .style('fill', (i) =>
      colors[domainIndex[i.provider]]
        ? colors[domainIndex[i.provider]]
        : colors[3]
    )
}

function scatterplot (
  data,
  yName, // the y column
  xName, // the x column
  marginLeft,
  marginRight, // right margin, in pixels
  xlabelDistance,
  I,
  voronoi,
  xRange,
  xScale,
  x,
  yScale,
  y,
  maxIDs,
  maxData,
  tooltipLineColor,
  tooltipLineStrokeTexture,
  horizontalLineStrokeSize,
  tickInterval,
  marginTop,
  marginBottom,
  chartHeight,
  chartWidth,
  xLabelShift,
  xAxisText,
  yAxisText
) {
  const xAxis = d3.axisBottom(xScale).ticks(tickInterval)
  // append x axis
  svg
    .append('g')
    .attr('transform', `translate(0,${chartHeight - marginBottom})`)
    .attr('class', 'xaxis')
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .call(xAxis)
    .call((g) =>
      g
        .append('text')
        .attr('x', chartWidth - marginRight)
        .attr('y', marginBottom - 4)
        .attr('transform', `translate(0,${-xLabelShift})`)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'end')
        .text(xAxisText)
    )
  const yAxis = isScaleLinear ? d3.axisLeft(yScale).tickFormat(d3.format('~s')) : d3.axisLeft(yScale)
  // append y axis
  svg
    .append('g')
    .attr('transform', `translate(${marginLeft},0)`)
    .attr('class', 'yaxis')
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .call(yAxis)
    .call((g) =>
      g
        .append('text')
        .attr('transform', 'rotate(270)')
        .attr('x', -marginTop)
        .attr('y', -50)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'end')
        .attr('font-size', `${smallLabelSize}px`)
        .text(yAxisText)
    )

  // max lines (h + v)
  svg
    .append('g')
    .selectAll('line')
    .data(maxData.slice(0, maxData.length - 1))
    .join('line')
    .attr('x1', (i) => xScale(x(i)) + circleSize)
    .attr('y1', (i) => yScale(y(i)))
    .attr('x2', (i) => xScale(i.nextX))
    .attr('y2', (i) => yScale(y(i)))
    .style('stroke', tooltipLineColor)
    .style('stroke-width', horizontalLineStrokeSize)
    .style('stroke-dasharray', tooltipLineStrokeTexture)
  svg
    .append('g')
    .selectAll('line')
    .data(maxData.slice(0, maxData.length - 1))
    .join('line')
    .attr('x1', (i) => xScale(i.nextX))
    .attr('y1', (i) => yScale(y(i)))
    .attr('x2', (i) => xScale(i.nextX))
    .attr('y2', (i) => yScale(i.nextY) + circleSize)
    .style('stroke', tooltipLineColor)
    .style('stroke-width', horizontalLineStrokeSize)
    .style('stroke-dasharray', tooltipLineStrokeTexture)

  // voronoi grid
  svg
    .append('g')
    .attr('stroke', 'none')
    .attr('fill', '#00000000')
    .selectAll('path')
    .data(I)
    .join('path')
    .attr('d', (i) => voronoi.renderCell(i))
    .attr('id', function (i) {
      return data[i].id
    })
    .attr('class', function (i) {
      return makeClass(data[i][xName], data[i][yName])
    })
  // .attr("centroid_x", (i) => d3.polygonCentroid(voronoi.cellPolygon(i))[0])
  // .attr("centroid_y", (i) => d3.polygonCentroid(voronoi.cellPolygon(i))[1])
  // .classed("voronoi", true)
    .on('mousemove touchstart', (e) =>
      mousemove(
        e,
        marginRight,
        xRange,
        data,
        colors,
        domainIndex,
        fontType,
        smallLabelSize
      )
    )

  // append circles
  svg
    .append('g')
    .attr('stroke-width', strokeSize)
    .selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', (i) => xScale(x(i)))
    .attr('cy', (i) => yScale(y(i)))
    .attr('r', circleSize)
    .style('cursor', 'pointer')
    .style('stroke', (i) =>
      colors[domainIndex[i.provider]]
        ? colors[domainIndex[i.provider]]
        : colors[3]
    )
    .style('fill', (i) =>
      colors[domainIndex[i.provider]]
        ? colors[domainIndex[i.provider]]
        : colors[3]
    )
    .style('fill-opacity', (i) => circleOpacity.achieved)
    .attr('id', (i) => i.id)
    .attr('class', (i) => {
      return maxIDs.includes(i.id) ? 'haslabel' : null
    })
    .attr('class', (i) => makeClass(x(i), y(i)))
    .attr('submissionId', (i) => i.submissionId)
    .attr('label', (i) => {
      if (i.arXiv && areLabelsArxiv) { return `arXiv:${i.arXiv}` } else return i.platformName ? i.platformName : i.methodName
    })
    .on('click', function () {
      if (!isMobile) {
        const submissionId = d3.select(this).attr('submissionId')
        window.open(`https://metriq.info/Submission/${submissionId}`)
      }
    })
    .on('mousemove touchstart', (e) =>
      mousemove(
        e,
        marginRight,
        xRange,
        data,
        colors,
        domainIndex,
        fontType,
        smallLabelSize
      )
    )

  // label
  d3.selectAll('circle').each(function (d, i) {
    const id = d3.select(this).attr('id')

    if (maxIDs.includes(id)) {
      const x = d3.select(`circle#${id}`).attr('cx')
      const y = d3.select(`circle#${id}`).attr('cy')

      const svgWidth = d3
        .select('#svgscatter')
        .node()
        .getBoundingClientRect().width

      const turnLabelBreakpoint = isMobile
        ? (svgWidth / 3) * 1.5
        : svgWidth / 3

      svg
        .append('text')
        .attr(
          'x',
          x > turnLabelBreakpoint
            ? Number(x) - xlabelDistance
            : Number(x) + xlabelDistance
        )
        .attr('y', Number(y))
        .attr('class', 'labeltohide')
        .style(
          'visibility',
          areLabelsVisible ? 'visible' : 'hidden'
        )
        .style(
          'font-size',
          isMobile ? `${mobileLabelSize}px` : `${smallLabelSize}px`
        )
        .style('font-family', fontType)
        .attr('text-anchor', x > turnLabelBreakpoint ? 'end' : 'start')
        .text(`${d3.select(`circle#${id}`).attr('label')}`)
    }
  })
}

// Function to draw plot
function plot (
  data,
  isScaleLinear = false,
  yAxisText = 'Quantum Volume  →',
  yName = 'metricValue', // the y column
  xAxisText = 'Date →',
  xName = 'tableDate', // the x column
  chartTarget = '#my_dataviz', // html target element to attach chart
  chartHeight = 600, // chart height
  marginTop = 40, // top margin, in pixels
  marginRight = 100, // right margin, in pixels
  marginBottom = 70, // bottom margin, in pixels
  xLabelShift = marginBottom - 40,
  marginLeft = 100, // left margin, in pixels
  rangeMult = 0.11,
  xScaleType = d3.scaleTime,
  horizontalLineStrokeSize = '1px',
  tooltipLineStrokeTexture = '1 1',
  tooltipLineColor = '#bbbbbb',
  tooltipLineTextBorder = 2.5,
  xlabelDistance = 19
) {
  data = data
    .filter(
      (x) => (!isNaN(x[xName]) && x[xName] > 0 && !isNaN(x[yName]) && x[yName] > 0)
    )
    .map(function (obj, index) {
      return { ...obj, id: `ID_${index + 1}` }
    })

  // list of IDs of data with max values
  // maxData with only max objects

  let maxIDs = []
  let currentMaxValue = -1

  const isQv = (metricName.toLowerCase() === 'quantum volume')

  data = data.filter((x) => x.metricName.toLowerCase() === metricName.toLowerCase())
  if (isQv && !isScaleLinear) {
    data = data.filter((x) => x.metricValue > 1)
  }

  data.map((d) => {
    if (isQv && !isScaleLinear) {
      d.metricValue = Math.log2(d.metricValue)
    }
    if (Number(d.metricValue) > currentMaxValue) {
      maxIDs = [...maxIDs, d.id]
      currentMaxValue = Number(d.metricValue)
    }

    return 0
  })

  const yScaleType = (isScaleLinear || isQv) ? d3.scaleLinear : d3.scaleLog
  if (isQv && !isScaleLinear) {
    yAxisText = 'Log-2 Quantum Volume  →'
  }

  const maxData = data.filter((d) => maxIDs.includes(d.id))
  maxData.map((d, i) => {
    if (i < maxData.length - 1) {
      d.nextX = maxData[i + 1][xName]
      d.nextY = maxData[i + 1][yName]
    }

    return 0
  })

  // define aesthetic mappings
  const x = (d) => d[xName]
  const y = (d) => d[yName]

  // width
  const chartWidth = d3.select(chartTarget).node().getBoundingClientRect().width
  if (isMobile) {
    marginLeft = 80
    marginRight = 50
  }

  // ranges
  const xRange = [marginLeft, chartWidth - marginRight] // [left, right]
  const yRange = [chartHeight - marginBottom, marginTop] // [bottom, top]

  // values
  const X = d3.map(data, x)
  const Y = d3.map(data, y)
  const I = d3.range(data.length)

  // domains
  const yMin = d3.min(Y)
  const xDomain = [d3.min(X), d3.max(X)]
  const yDomain = [yMin < 0 ? yMin : 0, d3.max(Y) + d3.max(Y) * rangeMult]

  // scale
  const xScale = xScaleType(xDomain, xRange)
  const yScale = yScaleType(yDomain, yRange)

  // time axes formatter
  // For a less crowded x axis, especially if we increase fontsize for labels
  const tickInterval = d3.timeMonth.every(12)

  // voronoi generator
  const dataForVoronoi = d3.map(I, (i) => [xScale(X[i]), yScale(Y[i])])
  const voronoiRange = [xRange[0], yRange[1], xRange[1], yRange[0]]
  const voronoi = d3.Delaunay.from(dataForVoronoi).voronoi(voronoiRange)

  // generate tooltip
  d3
    .select('body')
    .append('div')
    .attr('id', 'scatter-tooltip')
    .style('position', 'absolute')

  // initiate svg
  svg = d3
    .select(chartTarget)
    .append('svg')
    .attr('viewBox', [0, 0, chartWidth, chartHeight])
    .attr('id', 'svgscatter')
    .attr('style', 'max-width: 100%')

  // tooltip vlines
  svg
    .append('g')
    .selectAll('line')
    .data(data)
    .join('line')
    .attr('x1', (i) => xScale(x(i)))
    .attr('y1', (i) => yScale(y(i)) + circleSize)
    .attr('x2', (i) => xScale(x(i)))
    .attr('y2', yScale(1))
    .attr('id', (i) => i.id)
    .style('visibility', 'hidden')
    .style('stroke', tooltipLineColor)
    .style('stroke-width', horizontalLineStrokeSize)
    .style('stroke-dasharray', tooltipLineStrokeTexture)

  // tooltip vline text
  svg
    .append('g')
    .selectAll('text')
    .data(data)
    .join('text')
    .attr('x', (i) => xScale(x(i)) + tooltipLineTextBorder)
    .attr('y', yScale(1) - tooltipLineTextBorder)
    .attr('id', (i) => i.id)
    .style('visibility', 'hidden')
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .text((i) => d3.utcFormat('%B %Y')(x(i)))

  // tooltip hlines
  svg
    .append('g')
    .selectAll('line')
    .data(data)
    .join('line')
    .attr('x1', (i) => xScale(x(i)) - circleSize)
    .attr('y1', (i) => yScale(y(i)))
    .attr('x2', xScale(d3.min(X)))
    .attr('y2', (i) => yScale(y(i)))
    .attr('id', (i) => i.id)
    .style('visibility', 'hidden')
    .style('stroke', tooltipLineColor)
    .style('stroke-width', horizontalLineStrokeSize)
    .style('stroke-dasharray', tooltipLineStrokeTexture)

  // tooltip hline text
  svg
    .append('g')
    .selectAll('text')
    .data(data)
    .join('text')
    .attr('x', xScale(d3.min(X)) + tooltipLineTextBorder)
    .attr('y', (i) => yScale(y(i)) - tooltipLineTextBorder)
    .attr('id', (i) => i.id)
    .style('visibility', 'hidden')
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .text((i) => d3.format('.2s')(y(i)))

  let isSameDate = true
  for (let i = 1; i < data.length; ++i) {
    if (data[0].tableDate !== data[i].tableDate) {
      isSameDate = false
      break
    }
  }

  if (isSameDate) {
    barplot(
      data,
      xRange,
      [chartHeight - marginBottom / 2, marginTop],
      Y,
      marginLeft,
      marginTop,
      yAxisText
    )
  } else {
    scatterplot(
      data,
      yName, // the y column
      xName, // the x column
      marginLeft,
      marginRight, // right margin, in pixels
      xlabelDistance,
      I,
      voronoi,
      xRange,
      xScale,
      x,
      yScale,
      y,
      maxIDs,
      maxData,
      tooltipLineColor,
      tooltipLineStrokeTexture,
      horizontalLineStrokeSize,
      tickInterval,
      marginTop,
      marginBottom,
      chartHeight,
      chartWidth,
      xLabelShift,
      xAxisText,
      yAxisText
    )
  }
}

function mousemove (
  e,
  marginRight,
  xRange,
  data,
  colors,
  domainIndex,
  fontType, // font size in pixel
  smallLabelSize,
  selectionRadius = 50,
  tooltipOffsetX = 0,
  tooltipOffsetY = 0,
  border = '1px',
  borderColor = 'black',
  padding = '5px',
  borderRadius = '5px',
  backgroundColor = '#fafafa',
  arrowSize = 8,
  turnTooltip = 0.6
) {
  const mouseX = e.pageX
  const mouseY = e.pageY

  const targetID = e.target.id
  const targetClass = e.target.className.baseVal

  const selectedCircle = d3
    .select(`circle#${targetID}`)
    .node()
    .getBoundingClientRect()

  const xPerc = (selectedCircle.x - xRange[0]) / (xRange[1] - marginRight)

  const circleX = selectedCircle.x + window.scrollX + tooltipOffsetX
  const circleXshifted = circleX + selectedCircle.width
  const circleY = selectedCircle.y + window.scrollY + tooltipOffsetY

  const mouseDist = Math.sqrt((circleX - mouseX) ** 2 + (circleY - mouseY) ** 2)

  const otherCircles = d3.selectAll(`circle.${targetClass}`)

  if (mouseDist <= selectionRadius) {
    d3.selectAll('line.selectedLine')
      .attr('class', null)
      .style('visibility', 'hidden')

    d3.selectAll('text.selectedText')
      .attr('class', null)
      .style('visibility', 'hidden')

    d3.selectAll(`line#${targetID}`)
      .attr('class', 'selectedLine')
      .style('visibility', 'visible')

    d3.selectAll(`text#${targetID}`)
      .attr('class', 'selectedText')
      .style('visibility', 'visible')

    const idData = data.filter((d) => d.id === targetID)[0]

    d3.select('#scatter-tooltip')
      // Main tooltip
      .style('visibility', 'visible')
      .style('top', `${circleY}px`)
      .style('font-size', `${smallLabelSize}px`)
      .style('font-family', fontType)
      .style('border', border)
      .style('border-style', 'solid')
      .style('border-color', borderColor)
      .style('border-radius', borderRadius)
      .style('padding', padding)
      .style('background-color', backgroundColor)
      .style(
        'transform',
        `translateY(-50%) translateY(${selectedCircle.width / 2}px)`
      )
      .html(
        `
      <div>
        ${[...otherCircles._groups[0]]
          .map(
            (crcl) =>
              `<div style="font-size: 1.5em;">${crcl.__data__.platformName}</div>`
          )
          .join('')}
        ${d3.utcFormat('%B %d, %Y')(idData.tableDate)}<br>
        ${idData.methodName}<br>
        <a href="https://metriq.info/Submission/${
          idData.submissionId
        }" style="color: ${
          colors[domainIndex[idData.domain]]
        }; filter: brightness(0.85)">→ explore submission</a>
      </div>`
      )

    if (xPerc < turnTooltip) {
      d3.select('#scatter-tooltip')
        .style('right', null)
        .style('left', `${circleXshifted + arrowSize / 2}px`)
    } else {
      d3.select('#scatter-tooltip')
        .style('left', null)
        .style('right', `${window.innerWidth - circleX + arrowSize / 2}px`)
    }

    d3.select('#scatter-tooltip')
      // triangle
      .append('div')
      .attr('id', 'tooltip-triangle')
      .style('position', 'absolute  ')
      .style('content', '         ')
      .style('top', '50%')
      .style('left', `${xPerc < turnTooltip ? 0 : 100}%`)
      .style('transform', 'translateX(-50%) rotate(45deg)')
      .style('border', border)
      .style('border-style', 'solid')
      .style('margin-top', `-${arrowSize / 2}px`)
      .style('width', `${arrowSize}px`)
      .style('height', `${arrowSize}px`)
      .style(
        'border-color',
        xPerc < turnTooltip
          ? `transparent transparent ${borderColor} ${borderColor}`
          : `${borderColor} ${borderColor} transparent transparent`
      )
      .style('background-color', backgroundColor)
  } else {
    d3.select('#scatter-tooltip').style('visibility', 'hidden')

    d3.selectAll('line.selectedLine')
      .attr('class', null)
      .style('visibility', 'hidden')

    d3.selectAll('text.selectedText')
      .attr('class', null)
      .style('visibility', 'hidden')
  }
}

function redraw () {
  const scroll = window.scrollY
  isMobile = window.outerWidth < breakpoint
  d3.select('#svgscatter').remove()
  d3.select('#scatter-tooltip').remove()
  d3.selectAll('#svglegend').remove()
  plot(d, isScaleLinear, metricName)
  legend()
  window.scrollTo(0, scroll)
}

// Function to build legend
function legend (circleSizeFields = 8) {
  let multCoeff = 1
  if (isMobile) {
    multCoeff = 1.5
  }

  const chartTarget = '#legend-color' // html target element to attach chart
  const chartWidth = d3
    .select(chartTarget)
    .node()
    .getBoundingClientRect().width

  // initiate svg
  svg = d3
    .select(chartTarget)
    .append('svg')
    .attr('viewBox', [0, 0, chartWidth * multCoeff, chartHeight])
    .attr('id', 'svglegend')
    .style('width', '100%')

  let newY = circleSizeFields + 10

  // circle 1
  svg
    .append('circle')
    .attr('stroke-width', strokeSize)
    .attr('cx', circleSizeFields)
    .attr('cy', newY)
    .attr('r', circleSizeFields)
    .style('stroke', colors[domainIndex.ibmq])
    .style('stroke-opacity', strokeOpacity.fieldLegend)
    .style('fill', colors[domainIndex.ibmq])
    .style('fill-opacity', circleOpacity.fieldLegend)

  // circle 1 label
  svg
    .append('text')
    .attr('x', circleSizeFields * 2 + 15)
    .attr('y', newY + 4)
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .text('IBMQ')

  newY = newY + circleSizeFields + 20

  // circle 2
  svg
    .append('circle')
    .attr('stroke-width', strokeSize)
    .attr('cx', circleSizeFields)
    .attr('cy', newY)
    .attr('r', circleSizeFields)
    .style('stroke', colors[domainIndex.quantinuum])
    .style('stroke-opacity', strokeOpacity.fieldLegend)
    .style('fill', colors[domainIndex.quantinuum])
    .style('fill-opacity', circleOpacity.fieldLegend)

  // circle 2 label
  svg
    .append('text')
    .attr('x', circleSizeFields * 2 + 15)
    .attr('y', newY + 4)
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .text('Quantinuum')

  newY = newY + circleSizeFields + 20

  // circle 3
  svg
    .append('circle')
    .attr('stroke-width', strokeSize)
    .attr('cx', circleSizeFields)
    .attr('cy', newY)
    .attr('r', circleSizeFields)
    .style('stroke', colors[domainIndex.rigetti])
    .style('stroke-opacity', strokeOpacity.fieldLegend)
    .style('fill', colors[domainIndex.rigetti])
    .style('fill-opacity', circleOpacity.fieldLegend)

  // circle 3 label
  svg
    .append('text')
    .attr('x', circleSizeFields * 2 + 15)
    .attr('y', newY + 4)
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .text('Rigetti')

  newY = newY + circleSizeFields + 20

  // circle 4
  svg
    .append('circle')
    .attr('stroke-width', strokeSize)
    .attr('cx', circleSizeFields)
    .attr('cy', newY)
    .attr('r', circleSizeFields)
    .style('stroke', colors[domainIndex.other])
    .style('stroke-opacity', strokeOpacity.fieldLegend)
    .style('fill', colors[domainIndex.other])
    .style('fill-opacity', circleOpacity.fieldLegend)

  // circle 4 label
  svg
    .append('text')
    .attr('x', circleSizeFields * 2 + 15)
    .attr('y', newY + 4)
    .style('font-size', `${smallLabelSize}px`)
    .style('font-family', fontType)
    .text('Other')
}

function makeClass (x, y) {
  return `c${x - y}`
}

function QuantumVolumeChart (props) {
  const [metricNames, setMetricNames] = React.useState([])
  const [taskId, setTaskId] = React.useState(0)
  React.useEffect(() => {
    isScaleLinear = (parseInt(props.taskId) !== 34)
    if (taskId === props.taskId) {
      return
    }
    setTaskId(props.taskId)
    // Draw scatterplot from data
    const taskRoute = config.api.getUriPrefix() + '/task/' + props.taskId
    axios.get(taskRoute)
      .then(res => {
        const task = res.data.data
        taskName = task.fullName
        task.childTasks.sort(sortByCounts)
        if (props.onLoadData) {
          props.onLoadData(task)
        }
        const results = task.results
        metricName = ''
        const metricNameCounts = []
        for (let i = 0; i < results.length; ++i) {
          if (results[i].submissionUrl.toLowerCase().startsWith('https://arxiv.org/')) {
            const parts = results[i].submissionUrl.split('/')
            results[i].arXiv = (parts[parts.length - 1] === '') ? parts[parts.length - 2] : parts[parts.length - 1]
          } else {
            results[i].arXiv = results[i].methodName
          }

          if (metricNames.includes(results[i].metricName)) {
            ++metricNameCounts[metricNames.indexOf(results[i].metricName)]
          } else {
            metricNames.push(results[i].metricName)
            metricNameCounts.push(1)
            if (results[i].metricName.toLowerCase() === 'quantum volume') {
              metricName = 'quantum volume'
            }
          }
        }
        if (metricName === '') {
          const maxCount = metricNameCounts[0]
          let maxCountIndex = 0
          for (let i = 1; i < metricNames.length; ++i) {
            if (metricNameCounts[i] > maxCount) {
              maxCountIndex = i
            }
          }
          metricName = metricNames[maxCountIndex]
          if (maxCountIndex > 0) {
            const tmp = metricNames[0]
            metricNames[0] = metricNames[maxCountIndex]
            metricNames[maxCountIndex] = tmp
          }
        } else {
          const tmp = metricNames.indexOf(metricName)
          if (tmp > 0) {
            metricNames[tmp] = metricNames[0]
            metricNames[0] = metricName
          }
        }
        setMetricNames(metricNames)
        d = results
          .map((_d) => ({
            key: +_d.id,
            submissionId: +_d.submissionId,
            platformName: _d.platformName,
            methodName: _d.methodName,
            metricName: _d.metricName,
            metricValue: _d.metricValue,
            qubitCount: _d.qubitCount ? +_d.qubitCount : '',
            circuitDepth: _d.circuitDepth ? +_d.circuitDepth : '',
            provider: _d.providerName ? _d.providerName.toLowerCase() : 'Other',
            tableDate: Date.parse(_d.evaluatedAt),
            arXiv: _d.arXiv
          }))
          .sort((a, b) => a.tableDate > b.tableDate)
        redraw()
      })
      .catch(err => {
        window.alert('Could not load task! Check your connection and reload the page. (Error: ' + err + ')')
      })
  }, [props, metricNames, taskId, setTaskId])

  return (
    <span>
      <div className='row'>
        <div className='col text-left'>
          <h4 align='left'>{taskName}</h4>
        </div>
      </div>
      <div id='cargo'>
        <div id='my_dataviz' />
        <div id='legend_guide'>
          <div>
            <div id='legend-switch' style={{ marginTop: '10px' }}>
              <label className='switch'>
                <input id='labelSwitch' type='checkbox' onClick={onLabelSwitchClick} />
                <span className='slider round' />
              </label>
              <span className='legendTitle'>Show labels</span>
            </div>
            <div id='legend-switch' style={{ marginTop: '10px' }}>
              <label className='switch'>
                <input id='arXivSwitch' type='checkbox' onClick={onArxivSwitchClick} />
                <span className='slider round' />
              </label>
              <span className='legendTitle'>Labels | ID</span>
            </div>
            <div id='legend-switch' style={{ marginTop: '10px' }}>
              <label className='switch'>
                <input id='isScaleLinearSwitch' type='checkbox' onClick={onScaleSwitchClick} />
                <span className='slider round' />
              </label>
              <span className='legendTitle'>{isScaleLinear ? 'Linear | Log' : 'Log | Linear'}</span>
            </div>
            <div id='legend-switch' style={{ marginTop: '10px' }}>
              <label className='switch' style={{ width: '50%' }}>
                <select id='metricSelect' style={{ width: '100%' }} onChange={onMetricSelectChange}>
                  {metricNames.map((option, index) => <option key={index} value={option}>{option}</option>)}
                </select>
              </label>
              <span className='legendTitle' style={{ width: '50%', marginTop: '10px' }}> Metric</span>
            </div>
          </div>
          <div>
            <span className='legendTitle'>Providers</span>
            <div id='legend-color' style={{ marginTop: '10px' }} />
          </div>
          <div>
            <div id='legend-stroke' style={{ marginTop: '10px' }}>
              <button id='downloadButton' className='mybutton' onClick={onDownloadClick}>Download chart</button>
            </div>
          </div>
        </div>
      </div>
    </span>
  )
}

export default QuantumVolumeChart
