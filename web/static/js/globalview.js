class GlobalView extends View {
    constructor(data, svg) {
        super(data, svg, {});
        this.LINE_COLOR = 'steelblue'//'#ff8080'
        this.SELECTED_LINE_COLOR = 'steelblue'//'#ff8080'
        this.HOVER_LINE_COLOR = '#A8A3A3'//'#ff8080'
        this.NON_SELECTED_LINE_COLOR = '#A8A3A3'//'#ddd'
        this.xAxisLabel = 'Time (s)';
        this.yAxisLabel = 'Frequency';
        this._data = {};
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 900;
        this.container_height = 300;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.rank_of_interest_labels = {};
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
        me._rank = -1;
        this.line_area.selectAll('path').remove() // remove
        var lineData = this.getLineData();
        Object.keys(lineData).forEach(rank => {
            this.line_area.append('path')
                .datum(lineData[rank])
                .attr('class', 'globalview_line')
                .attr('fill', 'none')
                .attr('stroke', d => {
                    if (me.data.rank_of_interest.has(+d[0].rank)) {
                      return me.SELECTED_LINE_COLOR
                    } else {
                      return me.NON_SELECTED_LINE_COLOR
                    } 
                }) 
                .attr('stroke-width', d => (me.data.rank_of_interest.has(+d[0].rank) || +d[0].rank === +me._rank)? 1.5:0.5) 
                // .attr('stroke', this.LINE_COLOR)
                // .attr('stroke-width', 0.5)
                // .attr('stroke-linejoin', 'round')
                // .attr('stroke-linecap', 'round')
                .attr('d', d3.line() // Draw Lines
                    .x(function(d) { return me.xScale(d.time)})
                    .y(function(d) { return me.yScale(d.value)}))
        });
        this.lines = this.line_area.selectAll('path');
        this.apply_hover();
        this.display_roi_labels();
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
            .on('mouseleave', left)
            .on('click', clicked);
        me.line_area.selectAll('.globalview_hover_point').remove()
        me.hover_point = me.line_area.append('g')
            .attr('class', 'globalview_hover_point')
            .attr('display', 'none');
        me.hover_point.append('circle')
            .attr('r', 2.5);
        me.hover_point.append('text')
            .style('font', '14px')
            .style('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('y', -8);
        var times = Object.keys(me._data).map(Number);
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
            me.freqobj = Object.values(me._data)[i]
            var freqlist = Object.values(me.freqobj)
            var value = freqlist.reduce((a, b) => Math.abs(a - scaled_y) < Math.abs(b - scaled_y) ? a : b);
            me._rank = Object.keys(me.freqobj).filter(key => me.freqobj[key] === value)[0];  //Object.keys(freq).find(key => freq[key] === value);
            // console.log('--------------------------------------')
            // console.log('raw coordinate: ('+ mouse_coord_x +', '+ mouse_coord_y+')')
            // console.log('adjusted coordinate: ('+ adjusted_coord_x +', '+ adjusted_coord_y+')')
            // console.log('scaled coordinate: ('+ scaled_x +', '+ scaled_y+')')
            // console.log('value:'+value+', rank:'+me._rank)
            // console.log(me._data)
            me.lines
                .attr('stroke', d => {
                    if (me.data.rank_of_interest.has(+d[0].rank)) {
                      return me.SELECTED_LINE_COLOR
                    } else if (+d[0].rank === +me._rank) {
                      return me.HOVER_LINE_COLOR
                    } else {
                      return me.NON_SELECTED_LINE_COLOR
                    }
                }) 
                .attr('stroke-width', d => {
                    if(+d[0].rank === +me._rank){
                        return 3.5;
                    }else if(me.data.rank_of_interest.has(+d[0].rank)){
                        return 1.5;
                    }else{
                        return 0.5;
                    } 
                }) 
                .filter(d => (me.data.rank_of_interest.has(+d[0].rank) || +d[0].rank === +me._rank))
                    .moveToFront();
            
            // label for hover
            me.hover_point.attr('transform', `translate(${me.xScale(times[i])},${me.yScale(value)})`);
            me.hover_point.select('text').text('Rank#'+me._rank+' ('+value+')');
            me.hover_point.attr('display', null);
            me.hover_point.moveToFront();

            // label for selected ranks
            me.data.rank_of_interest.forEach(rank=>{
                if(!(rank in me.rank_of_interest_labels)) {
                    me.rank_of_interest_labels[rank] = me.line_area.append('g')
                        .attr('class', 'globalview_roi_label')
                        .attr('display', 'none');
                    me.rank_of_interest_labels[rank].append('circle')
                        .attr('r', 2.5);
                    me.rank_of_interest_labels[rank].append('text')
                        .style('font', '14px')
                        .style('font-weight', 'bold')
                        .attr('text-anchor', 'middle')
                        .attr('y', -8);
                }
                if (rank in me.freqobj) {
                    me.rank_of_interest_labels[rank].attr('transform', `translate(${me.xScale(times[i])},${me.yScale(me.freqobj[rank])})`);
                    me.rank_of_interest_labels[rank]
                        .select('text')
                        .text('Rank#'+rank+' ('+me.freqobj[rank]+')')
                        .attr('fill', 'blue');
                    me.rank_of_interest_labels[rank].attr('display', null);
                    me.rank_of_interest_labels[rank].moveToFront();
                } else {
                    me.rank_of_interest_labels[rank].remove();
                    me.data.rank_of_interest.delete(rank);
                    delete me.rank_of_interest_labels[rank];
                }
            });
        }
        function entered() {
            me.lines
                .style('mix-blend-mode', null)
                .attr('stroke-width', d => me.data.rank_of_interest.has(+d[0].rank)? 1.5:0.5)
                .attr('stroke', d => me.data.rank_of_interest.has(+d[0].rank)? me.SELECTED_LINE_COLOR:me.NON_SELECTED_LINE_COLOR);
            // me.hover_point.attr('display', null);
        }
        function left() {
            me.lines
                .style('mix-blend-mode', 'multiply')
                .attr('stroke-width', d => me.data.rank_of_interest.has(+d[0].rank)? 1.5:0.5)
                .attr('stroke', d => me.data.rank_of_interest.has(+d[0].rank)? me.SELECTED_LINE_COLOR:me.NON_SELECTED_LINE_COLOR);
            me.hover_point.attr('display', 'none');
        }
        function clicked() {
            console.log('clicked: '+me._rank)
            var _rank = +me._rank;
            if(me.data.rank_of_interest.has(_rank)) {
                me.data.rank_of_interest.delete(_rank)
                me.lines
                    .filter(d=>+d[0].rank == _rank)
                    .attr('stroke-width', 0.5)
                    .attr('stroke', me.NON_SELECTED_LINE_COLOR);
                me.rank_of_interest_labels[_rank].remove();
                delete me.rank_of_interest_labels[_rank];
            } else {
                me.data.rank_of_interest.add(_rank)
                me.lines
                    .filter(d=>+d[0].rank == _rank)
                    .attr('stroke-width', 1.5)
                    .attr('stroke', me.SELECTED_LINE_COLOR);
            }
            console.log(me.data.rank_of_interest)
            if (!me.scatterview) {
                me.scatterview = me.data.views.getView('scatterview');
            }
            me.scatterview.stream_update();
        }
    }
    display_roi_labels() {
        var me = this;
        me.data.rank_of_interest.forEach(rank=>{
            if(!(rank in me.rank_of_interest_labels)) {
                me.rank_of_interest_labels[rank] = me.line_area.append('g')
                    .attr('class', 'globalview_roi_label')
                    .attr('display', 'none');
                me.rank_of_interest_labels[rank].append('circle')
                    .attr('r', 2.5);
                me.rank_of_interest_labels[rank].append('text')
                    .style('font', '14px')
                    .style('font-weight', 'bold')
                    .attr('text-anchor', 'middle')
                    .attr('y', -8);
            }
            var times = Object.keys(me._data);
            var values = Object.values(me._data);
            var last_time = times[times.length-1]
            var last_values = values[values.length-1];
            if (rank in values[values.length-1]) {
                me.rank_of_interest_labels[rank]
                    .attr('transform', `translate(${me.xScale(last_time)},${me.yScale(last_values[rank])})`);
                me.rank_of_interest_labels[rank]
                    .select('text')
                    .text('Rank#'+rank+' ('+last_values[rank]+')')
                    .attr('fill', 'blue');
                me.rank_of_interest_labels[rank]
                    .attr('display', null)
                    .moveToFront();
            } else {
                me.rank_of_interest_labels[rank].attr('display', 'none')
            }
        });
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};