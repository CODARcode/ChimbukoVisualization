class DeltaView extends View {
    constructor(data, svg, name) {
        super(data, svg, {});
        this.name = name
        this.xAxisLabel = 'Rank';
        this.yAxisLabel = 'Accumulated Delta';
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 500;
        this.container_height = 500;
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
        this._data = this.getDeltaData()
        this.adjust_scale();
        this.draw();
    }
    getDeltaData() {
        /**
         * Prepares proper format for rendering delta plot
         * 
         * the format is like below:
         * result == {
         *      frame_id: {
         *          'top': {
         *              'rank': rank_id,
         *              'value': delta value
         *          },
         *           'bottom': {
         *              'rank': rank_id,
         *              'value': delta value
         *          }
         *      }
         * }
         */
        var res = {}
        var topRanks = this.data.selectedRanks[0]
        var bottomRanks = this.data.selectedRanks[1]
        var maxLength = Math.max(topRanks.length, bottomRanks.length) 
        for (var i=0; i<maxLength; i++) {
            res[i] = {}
            if(topRanks[i] !== undefined) {
                res[i]['top'] = {
                    'rank': topRanks[i],
                    'value': this.data.renderingDelta[topRanks[i]]
                }
            }
            if(bottomRanks[i] !== undefined){
                res[i]['bottom'] = {
                    'rank': bottomRanks[i],
                    'value': this.data.renderingDeltaBottom[bottomRanks[i]]
                }
            }
        }
        return res;
    }
    getX(d) {
        return Number(d)
    }
    getYMax(d) {
        var t = d.top? d.top.value : 0
        var b = d.bottom? d.bottom.value : 0
        return Math.max(t, b)
    }
    getTopMax(d) {
        var t  = d.top? (Number(d.top.rank)+20) : 0;
        return t;
    }
    getBottomMax(d) {
        var b  = d.bottom? (Number(d.bottom.rank)+20) : 0;
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
        this.xAxis.selectAll('text.historyview_xLabel').remove();
        this.yAxis.selectAll('text.historyview_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom).append('text')
                .attr('class', 'historyview_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 30)
                .style('text-anchor', 'middle')
                .text(this.xAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
        this.yAxis.call(this.axisLeft)
            .append('text')
                .attr('class', 'historyview_yLabel')
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
            if (this._data[i].top !== undefined) {
                res.push({
                    'class': Number(i),
                    'rank': Number(this._data[i].top.rank),
                    'value': this._data[i].top.value,
                    'fill': this.topColorScale(Number(this._data[i].top.rank)+7.5),
                    'type': 0
                });
            }
            if (this._data[i].bottom !== undefined) {
                res.push({
                    'class': Number(i),
                    'rank': Number(this._data[i].bottom.rank),
                    'value': this._data[i].bottom.value,
                    'fill': this.bottomColorScale(Number(this._data[i].bottom.rank)+7.5),
                    'type': 1
                });
            }
        });
        return res;
    }
    getLegendData() {
        var top = {}
        var bottom = {}
        this.barData.forEach(d => {
            if (d.type==0) {
                top[d.rank] = d
            } else {
                bottom[d.rank] = d
            }
        })
        return [top, bottom];
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