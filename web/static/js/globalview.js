class GlobalView extends View {
    constructor(data, svg) {
        super(data, svg, {});
        this.LINE_COLOR = 'steelblue'//'#ff8080'
        this.xAxisLabel = 'Time (s)';
        this.yAxisLabel = 'Frequency';
        this._data = {};
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 900;
        this.container_height = 300;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.svg
            .attr('class', 'globalview_svg')
            .attr('width', this.container_width)
            .attr('height', this.container_height);
        this.line_area = this.svg.append('g')
            .attr('class', 'globalview_line_area')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('width', this.content_width)
            .attr('height', this.content_height);
        this.xAxis = this.svg.append('g')
            .attr('class', 'globalview_x_axis')
            .attr('transform', 'translate('+this.margin.left+',' + (this.content_height+this.margin.top) + ')');
        this.yAxis = this.svg.append('g')
            .attr('class', 'globalview_y_axis')
            .attr('transform', 'translate('+this.margin.left+',' + this.margin.top + ')');
    }
    stream_update(){
        this._data = this.data.global_rank_anomaly;
        this.adjust_scale();
        this.draw();
    }
    get_y_max(d) {
        return Math.max(...Object.values(d));
    }
    adjust_scale() {
        this.xScale = d3.scaleLinear().range([0, this.content_width]).domain(d3.extent(Object.keys(this._data).map(Number)));
        this.yScale = d3.scaleLinear().range([this.content_height, 0]).domain([0, d3.max(Object.values(this._data).map(this.get_y_max))]);
    }
    draw() {
        this._updateAxis();
        this._drawline();
    }
    _updateAxis() {
        this.xAxis.selectAll('text.globalview_xLabel').remove();
        this.yAxis.selectAll('text.globalview_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom)
            .append('text')
                .attr('class', 'globalview_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 30)
                .style('text-anchor', 'middle')
                .text(this.xAxisLabel);
        this.yAxis.call(this.axisLeft)
            .append('text')
                .attr('class', 'globalview_yLabel')
                .attr('transform', 'rotate(-90)')
                .attr('y', -42)
                .attr('x', -this.content_height/2)
                .attr('dy', '.71em')
                .style('text-anchor', 'middle')
                .text(this.yAxisLabel);
    }
    _drawline() {
        var me = this;
        this.line_area.selectAll('path').remove() // remove
        var lineData = this.getLineData();
        Object.keys(lineData).forEach(rank => {
            this.line_area.append('path')
                .datum(lineData[rank])
                .attr('class', 'globalview_line')
                .attr('fill', 'none')
                .attr('stroke', this.LINE_COLOR)
                .attr('stroke-width', 0.5)
                // .attr('stroke-linejoin', 'round')
                // .attr('stroke-linecap', 'round')
                .attr('d', d3.line() // Draw Lines
                    .x(function(d) { return me.xScale(d.time)})
                    .y(function(d) { return me.yScale(d.value)}))
        });
        this.lines = this.line_area.selectAll('path')
        this.apply_hover();
    }
    getLineData() {
        var res = {}
        Object.keys(this._data).forEach(t => {
            var d = this._data[t]
            Object.keys(d).forEach(rank => {
                if (! res[rank]) {
                    res[rank] = []
                }
                res[rank].push({
                    'time': t,
                    'value': d[rank],
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
            .on('touchstart', entered)
            .on('touchend', left)
        else me.svg
            .on('mousemove', moved)
            .on('mouseenter', entered)
            .on('mouseleave', left);
        me.line_area.selectAll('.globalview_label_point').remove()
        me.label_point = me.line_area.append('g')
            .attr('class', 'globalview_label_point')
            .attr('display', 'none');
        me.label_point.append('circle')
            .attr('r', 2.5);
        me.label_point.append('text')
            .style('font', '14px')
            .style('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('y', -8);
        var times = Object.keys(me._data).map(Number);
        function moved() { //debugger
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
            var freqobj = Object.values(me._data)[i]
            var freqlist = Object.values(freqobj)
            var value = freqlist.reduce((a, b) => Math.abs(a - scaled_y) < Math.abs(b - scaled_y) ? a : b);
            me._rank = Object.keys(freqobj).filter(key => freqobj[key] === value)[0];  //Object.keys(freq).find(key => freq[key] === value);
            console.log('--------------------------------------')
            console.log('raw coordinate: ('+ mouse_coord_x +', '+ mouse_coord_y+')')
            console.log('adjusted coordinate: ('+ adjusted_coord_x +', '+ adjusted_coord_y+')')
            console.log('scaled coordinate: ('+ scaled_x +', '+ scaled_y+')')
            console.log('value:'+value+', rank:'+me._rank)
            console.log(me._data)
            me.lines
                .attr('stroke', d => +d[0].rank === +me._rank ? me.LINE_COLOR : '#ddd') 
                .attr('stroke-width', d => +d[0].rank === +me._rank ? 1.5 : 0.5) 
                .filter(d => +d[0].rank === +me._rank).moveToFront();
            me.label_point.attr('transform', `translate(${me.xScale(times[i])},${me.yScale(value)})`);
            me.label_point.select('text').text('Rank#'+me._rank+' ('+value+')');
            me.label_point.attr('display', null);
            me.label_point.moveToFront();
        }
        function entered() {
            me.lines.style('mix-blend-mode', null).attr('stroke', '#ddd');
            // me.label_point.attr('display', null);
        }
        function left() {
            me.lines.style('mix-blend-mode', 'multiply').attr('stroke', me.LINE_COLOR).attr('stroke-width', 0.5) ;
            me.label_point.attr('display', 'none');
        }
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};