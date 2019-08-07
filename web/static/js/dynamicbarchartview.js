class DynamicBarChartView extends View {

    constructor(data, svg, name) {
        super(data, svg, {
            'width': componentLayout.DYNAMIC_BAR_CHART_WIDTH,
            'height': componentLayout.DYNAMIC_BAR_CHART_HIEGHT
        });
        this.name = name
        this.margin = {
            top: componentLayout.DYNAMIC_BAR_CHART_MARGIN_TOP, 
            right: componentLayout.DYNAMIC_BAR_CHART_MARGIN_RIGHT, 
            bottom: componentLayout.DYNAMIC_BAR_CHART_MARGIN_BOTTOM, 
            left: componentLayout.DYNAMIC_BAR_CHART_MARGIN_LEFT
        };
        this.container_width = componentLayout.DYNAMIC_BAR_CHART_WIDTH;
        this.container_height = componentLayout.DYNAMIC_BAR_CHART_HEIGHT;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.svg
            .attr('class', this.name+'_svg')
            .attr('width', this.container_width)
            .attr('height', this.container_height);
        this.content_area = this.svg.append('g')
            .attr('class', this.name+'_content_area')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('width', this.content_width)
            .attr('height', this.content_height);
        this.xAxis = this.svg.append('g')
            .attr('class', this.name+'_x_axis')
            .attr('transform', 'translate('+this.margin.left+',' + (this.content_height+this.margin.top) + ')');
        this.yAxis = this.svg.append('g')
            .attr('class', this.name+'_y_axis')
            .attr('transform', 'translate('+this.margin.left+',' + this.margin.top + ')');
        this.legend = d3.select('#'+this.name+'-legend');
        this._legend = d3.select('#'+this.name+'-bottom-legend');
    }

    stream_update(){
        /**
         * Called whenever data has received from backend.
         * Invokes rendering process
        **/
        this._update()
    }

    _update(){
        /**
         * Renders delta plot after data converting and scales adjustment
        **/
        this._data = this.processData()
        this.setAxisLabels();
        this.adjust_scale();
        this.draw();
    }

    setAxisLabels() {
        /**
         * Set x, y axis labels 
        **/
        this.xAxisLabel = 'Rank'; // to be dynamic 
        this.yAxisLabel = 'Accumulated Delta';
    }

    processData() {
        /**
         * Prepares proper format for rendering delta plot --> to be dynamic
         * 
         * the format is like below:
         * result == {
         *      frame_id: {
         *          'category1': {
         *              'name': rank_id,
         *              'value': delta value
         *          },
         *           'category2': {
         *              'name': rank_id,
         *              'value': delta value
         *          }
         *      }
         * }
         * 
         */
        var res = {}
        var category1 = this.data.selectedRanks[0]
        var category2 = this.data.selectedRanks[1]
        var maxLength = Math.max(category1.length, category2.length) 
        for (var i=0; i<maxLength; i++) {
            res[i] = {}
            if(category1[i] !== undefined) {
                res[i]['category1'] = {
                    'name': category1[i],
                    'value': this.data.renderingDelta[category1[i]]
                }
            }
            if(category2[i] !== undefined){
                res[i]['category2'] = {
                    'name': category2[i],
                    'value': this.data.renderingDeltaBottom[category2[i]]
                }
            }
        }
        return res;
    }
    getX(d) {
        return Number(d)
    }
    getYMax(d) {
        var t = d.category1? d.category1.value : 0
        var b = d.category2? d.category2.value : 0
        return Math.max(t, b)
    }
    getTopMax(d) {
        var t  = d.category1? (Number(d.category1.name)+20) : 0;
        return t;
    }
    getBottomMax(d) {
        var b  = d.category2? (Number(d.category2.name)+20) : 0;
        return b;
    }
    adjust_scale() {
        this.xScale = d3.scaleBand().range([0, this.content_width]).domain(Object.keys(this._data).map(this.getX)).paddingInner(0.05);
        this.yScale = d3.scaleLinear().range([this.content_height, 0]).domain([0, d3.max(Object.values(this._data).map(this.getYMax))]);
        this.topColorScale = d3.scaleSequential().domain([0, d3.max(Object.values(this._data).map(this.getTopMax))]).interpolator(d3.interpolateReds); //interpolateReds , interpolateYlOrRd
        this.bottomColorScale = d3.scaleSequential().domain([0, d3.max(Object.values(this._data).map(this.getBottomMax))]).interpolator(d3.interpolateBlues); //interpolateBlues , interpolateGnBu
    }
    draw() {
        this._updateAxis();
        this._drawBars();
        this._drawLegend();
    }
    _updateAxis() {
        this.xAxis.selectAll('text.'+this.name+'_xLabel').remove();
        this.yAxis.selectAll('text.'+this.name+'_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom).append('text')
                .attr('class', this.name+'_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 30)
                .style('text-anchor', 'middle')
                .text(this.xAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
        this.yAxis.call(this.axisLeft)
            .append('text')
                .attr('class', this.name+'_yLabel')
                .attr('transform', 'rotate(-90)')
                .attr('y', -42)
                .attr('x', -this.content_height/2)
                .attr('dy', '.71em')
                .style('text-anchor', 'middle')
                .text(this.yAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
    }
    _drawBars() {
        var me = this;
        me._rank = -1;
        this.content_area.selectAll('rect').remove() 
        this.barData = this.getBarData();
        this.content_area.selectAll('rect')
            .data(this.barData).enter()
                .append("rect")
                .style("fill", d => d.fill)
                .attr("x", function(d) { 
                    // console.log('rank #: '+d.rank+', x: '+me.xScale(d.rank))
                    return (d.type==0)? me.xScale(d.class) : me.xScale(d.class) +15
                })
                .attr("width", d => {
                    var width = me.xScale.bandwidth()<50? me.xScale.bandwidth() : 50
                    return (d.type==0)? width : width -15
                })
                .attr("y", function(d) { 
                    // console.log('value: '+d.value+', y: '+me.yScale(d.value))
                    return me.yScale(d.value)
                })
                .attr("height", function(d) { 
                    // console.log('content_height: '+me.content_height+', me.yScale(d.value): '+ me.yScale(d.value))
                    return me.content_height - me.yScale(d.value); }
                );
        this.bars = this.content_area.selectAll(this.name+'_bar');
    }
    getBarData() {
        var res = []
        Object.keys(this._data).forEach(i => {
            if (this._data[i].category1 !== undefined) {
                res.push({
                    'class': Number(i),
                    'name': Number(this._data[i].category1.name),
                    'value': this._data[i].category1.value,
                    'fill': this.topColorScale(Number(this._data[i].category1.name)+7.5),
                    'type': 0
                });
            }
            if (this._data[i].category2 !== undefined) {
                res.push({
                    'class': Number(i),
                    'name': Number(this._data[i].category2.name),
                    'value': this._data[i].category2.value,
                    'fill': this.bottomColorScale(Number(this._data[i].category2.name)+7.5),
                    'type': 1
                });
            }
        });
        return res;
    }
    getLegendData() {
        var cat1 = {}
        var cat2 = {}
        this.barData.forEach(d => {
            if (d.type==0) {
                cat1[d.name] = d
            } else {
                cat2[d.name] = d
            }
        })
        return [cat1, cat2];
    }
    _drawLegend() {
        var me = this;
        me.legend.selectAll('.'+this.name+'-legend-item').remove();
        me._legend.selectAll('.'+this.name+'-legend-item').remove();
        this.legendData = this.getLegendData()
        this.makeLegend(me.legend, this.legendData[0])
        this.makeLegend(me._legend, this.legendData[1])
    }

    makeLegend(target, legendData) {
        var me = this;
        var ranks = Object.keys(legendData)
        ranks.sort(function(x, y) {
            return d3.ascending(legendData[y].value, legendData[x].value);
        })
        var legend = target.selectAll('.'+this.name+'-legend-item').data(ranks).enter()
            .append('div')
                .attr('class', this.name+'-legend-item')
                .on('click', function(d) {
                    var rankno = d
                    console.log('clicked: '+rankno)
                    me.selectedRankNo = rankno;
                    me.data.rankHistoryInfo = {
                        'rank': rankno,
                        'fill': legendData[d].fill
                    }
                    if (!me.historyview) {
                        me.historyview = me.data.views.getView('historyview');
                    }
                    me.historyview._update();
                    me.draw();
                });
        legend.append('div')
            .attr('class', this.name+'-legend-item-circle')
            .style('background', function(d){
                return legendData[d].fill
            });
        legend.append('text')
            .attr('class', this.name+'-legend-item-text')
            .style('color', function(d) {
                return (me.selectedRankNo=== d)? 'black':'gray';
            })
            .style('font-weight', function(d) {
                return (me.selectedRankNo=== d)? 'bold':'';
            })
            .text(function(d){
                return 'MPI Rank ID: '+d+' ('+legendData[d].value+')'
            })
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};