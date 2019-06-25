class StreamView extends View {
    constructor(data, svg, name) {
        super(data, svg, {});
        this.name = name
        this.xAxisLabel = 'Frame';
        this.yAxisLabel = (this.name=='deltaview' || this.name=='deltaview-bottom')? 'Accumulated Delta': '# Anomaly';
        this.frames = {};
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 800;
        this.container_height = 300;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.rank_of_interest_labels = {};
        this.svg
            .attr('class', this.name+this.name+'_svg')
            .attr('width', this.container_width)
            .attr('height', this.container_height);
        this.line_area = this.svg.append('g')
            .attr('class', this.name+'_line_area')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('width', this.content_width)
            .attr('height', this.content_height);
        this.xAxis = this.svg.append('g')
            .attr('class', this.name+'_x_axis')
            .attr('transform', 'translate('+this.margin.left+',' + (this.content_height+this.margin.top) + ')');
        this.yAxis = this.svg.append('g')
            .attr('class', this.name+'_y_axis')
            .attr('transform', 'translate('+this.margin.left+',' + this.margin.top + ')');
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory20c).domain(d3.range(0,1000));
        this.STROKE_WIDTH_SELECTED = 3
        this.STROKE_WIDTH = 1.0
        this.selectedRankNo = -1;
        this.legend = d3.select('#'+this.name+'-legend');
    }
    stream_update(){
        this.frames = this.getFrames();
        this.adjust_scale();
        this.draw();
    }
    getFrames() {
        if (this.name == 'streamview'){
            return this.data.renderingFrames 
        } else if (this.name == 'streamview-bottom'){
            return this.data.renderingFramesBottom;
        } else if (this.name == 'deltaview'){
            return this.data.renderingDelta;
        }  else if (this.name == 'deltaview-bottom'){
            return this.data.renderingDeltaBottom;
        }
    }
    get_y_max(d) {
        return Math.max(...Object.values(d));
    }
    adjust_scale() {
        this.xScale = d3.scaleLinear().range([0, this.content_width]).domain(d3.extent(Object.keys(this.frames).map(Number)));
        this.yScale = d3.scaleLinear().range([this.content_height, 0]).domain([0, d3.max(Object.values(this.frames).map(this.get_y_max))]);
    }
    draw() {
        this._updateAxis();
        this._drawLine();
        this._drawLegend();
    }
    _updateAxis() {
        this.xAxis.selectAll('text.'+this.name+'_xLabel').remove();
        this.yAxis.selectAll('text.'+this.name+'_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom)
        this.xAxis.append('text')
                .attr('class', this.name+'_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 30)
                .style('text-anchor', 'middle')
                .text(this.xAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
        this.yAxis.call(this.axisLeft)
        this.yAxis.append('text')
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
    _drawLine() {
        var me = this;
        me._rank = -1;
        this.line_area.selectAll('path').remove() // remove
        var lineData = this.getLineData();
        Object.keys(lineData).forEach(rank => {
            this.line_area.append('path')
                .datum(lineData[rank])
                .attr('class', this.name+'_line')
                .attr('fill', 'none')
                .attr('stroke',d => (me.colorScale(d[0].rank))) 
                .attr('stroke-width', this.STROKE_WIDTH) 
                .attr('d', d3.line() // Draw Lines
                    .x(function(d) { return me.xScale(d.time)})
                    .y(function(d) { return me.yScale(d.value)}))
                .filter(function(d){
                    if(me.selectedRankNo == d[0].rank) {
                        console.log('Selected line:'+ me.selectedRankNo)
                        return true;
                    }
                    return false;
                })
                    .attr('stroke-width', this.STROKE_WIDTH_SELECTED) 
                    .moveToFront();
        });
        this.lines = me.line_area.selectAll('.'+this.name+'_line');
        this.apply_hover();
    }
    getLineData() {
        var res = {}
        Object.keys(this.frames).forEach(t => {
            var d = this.frames[t]
            Object.keys(d).forEach(rank => {
                if (! res[rank]) {
                    res[rank] = []
                }
                res[rank].push({
                    'time': Number(t),
                    'value': Number(d[rank]),
                    'rank': rank
                })
            })
        });
        return res;
    }
    apply_hover() {
        var me = this;
        if ('ontouchstart' in document) me.svg
            .style('-webkit-tap-highlight-color', 'transparent')
            .on('touchmove', moved)
        else me.svg
            .on('mousemove', moved)
            .on('click', clicked);
        me.line_area.selectAll('.'+this.name+'_hover_point').remove()
        me.hover_point = me.line_area.append('g')
            .attr('class', this.name+'_hover_point')
            .attr('display', 'none');
        me.hover_point.append('circle')
            .attr('r', 2.5);
        me.hover_point.append('text')
            .style('font', '14px')
            .style('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('y', -8);
        var times = Object.keys(me.frames).map(Number);
        
        function moved() { 
            d3.event.preventDefault();
            var mouse_coord_x = d3.event.layerX
            var mouse_coord_y = d3.event.layerY
            var adjusted_coord_x = mouse_coord_x -me.margin.left 
            var adjusted_coord_y = mouse_coord_y -me.margin.bottom 
            var scaled_x = me.xScale.invert(adjusted_coord_x)  //d3.event.layerX
            var scaled_y = me.yScale.invert(adjusted_coord_y)  +me.margin.top
            var i1 = d3.bisectLeft(times, scaled_x, 1);
            var i0 = i1 - 1;
            var i = scaled_x - times[i0] > times[i1] - scaled_x ? i1 : i0;
            me.freqobj = Object.values(me.frames)[i]
            var freqlist = Object.values(me.freqobj)
            var value = freqlist.reduce((a, b) => Math.abs(a - scaled_y) < Math.abs(b - scaled_y) ? a : b);
            me._rank = Object.keys(me.freqobj).filter(key => me.freqobj[key] === value)[0];  //Object.keys(freq).find(key => freq[key] === value);
            // console.log('--------------------------------------')
            // console.log('raw coordinate: ('+ mouse_coord_x +', '+ mouse_coord_y+')')
            // console.log('adjusted coordinate: ('+ adjusted_coord_x +', '+ adjusted_coord_y+')')
            // console.log('scaled coordinate: ('+ scaled_x +', '+ scaled_y+')')
            // console.log('value:'+value+', rank:'+me._rank)
            // console.log(me.frames)
            // label for hover
            // me.hover_point.attr('transform', `translate(${me.xScale(times[i])},${me.yScale(value)})`);
            // me.hover_point.select('text').text('Rank#'+me._rank+' ('+value+')');
            // me.hover_point.attr('display', null);
            // me.hover_point.moveToFront();
        }
        
        function clicked() {
            console.log('clicked: ' + me._rank)
            var _me = me;
            me.selectedRankNo = me._rank;
            me.data.rankHistoryInfo = {
                'rank': me.selectedRankNo,
                'fill': me.colorScale(me.selectedRankNo),
                'from': me.name
            }
            if (!me.historyview) {
                me.historyview = me.data.views.getView('historyview');
            }
            me.historyview._update();
            
            me.line_area.selectAll('.'+this.name+'_line')
                .filter(function(d){
                    return (me.selectedRankNo == d[0].rank);
                })
                    .attr('stroke-width', this.STROKE_WIDTH_SELECTED) 
                    .moveToFront();
            me.draw();
        }
    }

    getLegendData() {
        this.legendData = {};
        var len = Object.keys(this.frames).length
        if (len>0) {
            var max = Math.max(...Object.keys(this.frames))
            var frame = this.frames[max]
            Object.keys(frame).forEach(rank => {
                if (!this.legendData[rank]) {
                    this.legendData[rank] = {
                        'fill': this.colorScale(rank),
                        'delta': this.data.delta[rank]
                    }
                }
            })
        }
    }

    _drawLegend() {
        var me = this;
        me.getLegendData();
        me.legend.selectAll('.'+this.name+'-legend-item').remove();
        var ranks = Object.keys(me.legendData)
        ranks.sort(function(x, y) {
            return d3.ascending(me.data.delta[y], me.data.delta[x]);
        })
        var legend = me.legend.selectAll('.'+this.name+'-legend-item').data(ranks).enter()
            .append('div')
                .attr('class', this.name+'-legend-item')
                .on('click', function(d) {
                    var rankno = d
                    console.log('clicked: '+rankno)
                    var _me = me;
                    me.selectedRankNo = rankno;
                    me.data.rankHistoryInfo = {
                        'rank': rankno,
                        'fill': me.colorScale(rankno),
                        'from': me.name
                    }
                    if (!me.historyview) {
                        me.historyview = me.data.views.getView('historyview');
                    }
                    me.historyview._update();
                    me.line_area.selectAll('.'+this.name+'_line')
                        .filter(function(d){
                            return (me.selectedRankNo == d[0].rank);
                        })
                            .attr('stroke-width', this.STROKE_WIDTH_SELECTED) 
                            .moveToFront();
                    me.draw();
                });
        legend.append('div')
            .attr('class', this.name+'-legend-item-circle')
            .style('background', function(d){
                return me.legendData[d].fill
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
                return 'MPI Rank ID: '+d+' ('+me.legendData[d].delta+')'
            })
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};