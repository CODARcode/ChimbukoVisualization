class StreamView extends View {
    constructor(data, svg) {
        super(data, svg, {});
        this.name = 'streamview'
        this.LINE_COLOR = 'steelblue'//'#ff8080'
        this.SELECTED_LINE_COLOR = 'steelblue'//'#ff8080'
        this.HOVER_LINE_COLOR = '#A8A3A3'//'#ff8080'
        this.NON_SELECTED_LINE_COLOR = '#A8A3A3'//'#ddd'
        this.xAxisLabel = 'Frame';
        this.yAxisLabel = '#. Anomalies';
        this._data = {};
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 700;
        this.container_height = 300;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.rank_of_interest_labels = {};
        this.svg
            .attr('class', 'streamview_svg')
            .attr('width', this.container_width)
            .attr('height', this.container_height);
        this.line_area = this.svg.append('g')
            .attr('class', 'streamview_line_area')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('width', this.content_width)
            .attr('height', this.content_height);
        this.xAxis = this.svg.append('g')
            .attr('class', 'streamview_x_axis')
            .attr('transform', 'translate('+this.margin.left+',' + (this.content_height+this.margin.top) + ')');
        this.yAxis = this.svg.append('g')
            .attr('class', 'streamview_y_axis')
            .attr('transform', 'translate('+this.margin.left+',' + this.margin.top + ')');
    }
    stream_update(){
        this._data = this.data.frames;
        this.adjust_scale();
        this.draw();
        this._updateCurrentView();
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
        this.xAxis.selectAll('text.streamview_xLabel').remove();
        this.yAxis.selectAll('text.streamview_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom)
            .append('text')
                .attr('class', 'streamview_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 30)
                .style('text-anchor', 'middle')
                .text(this.xAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
        this.yAxis.call(this.axisLeft)
            .append('text')
                .attr('class', 'streamview_yLabel')
                .attr('transform', 'rotate(-90)')
                .attr('y', -42)
                .attr('x', -this.content_height/2)
                .attr('dy', '.71em')
                .style('text-anchor', 'middle')
                .text(this.yAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
    }
    _drawline() {
        var me = this;
        me._rank = -1;
        this.line_area.selectAll('path').remove() // remove
        var lineData = this.getLineData();
        this.line_area.append('path')
            .datum(lineData)
            .attr('class', 'streamview_line')
            .attr('fill', 'none')
            .attr('stroke', me.SELECTED_LINE_COLOR) 
            .attr('stroke-width', 1.5) 
            .attr('d', d3.line() // Draw Lines
                .x(function(d) { return me.xScale(d.frameno)})
                .y(function(d) { return me.yScale(d.value)}))
        this.lines = this.line_area.selectAll('path');
        this.apply_hover();
        // this.display_roi_labels();
    }
    getLineData() {
        var res = []
        this.maxFrameNo = -1
        Object.keys(this._data).forEach(frameno => {
            var frame = this._data[frameno]
            res.push({
                'frameno': frameno,
                'value': frame['total'],
            })
            console.log(typeof frameno)
            frameno = Number(frameno)
            if(this.maxFrameNo < frameno) {
                this.maxFrameNo = frameno
            }
        });
        return res;
    }
    apply_hover() {
        var me = this;
        if ('ontouchstart' in document) me.svg
            .style('-webkit-tap-highlight-color', 'transparent')
            .on('touchmove', moved)
            // .on('touchstart', entered)
            // .on('touchend', left)
        else me.svg
            .on('mousemove', moved)
            // .on('mouseenter', entered)
            // .on('mouseleave', left)
            .on('click', clicked);
        me.line_area.selectAll('.streamview_hover_point').remove()
        me.hover_point = me.line_area.append('g')
            .attr('class', 'streamview_hover_point')
            .attr('display', 'none');
        me.hover_point.append('circle')
            .attr('r', 2.5);
        me.hover_point.append('text')
            .style('font', '14px')
            .style('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('y', -8);
        var framenos = Object.keys(me._data).map(Number);
        function moved() { 
            d3.event.preventDefault();
            var mouse_coord_x = d3.event.layerX
            var mouse_coord_y = d3.event.layerY
            var adjusted_coord_x = mouse_coord_x -me.margin.left 
            var adjusted_coord_y = mouse_coord_y -me.margin.bottom 
            var scaled_x = me.xScale.invert(adjusted_coord_x)  //d3.event.layerX
            var scaled_y = me.yScale.invert(adjusted_coord_y)  +me.margin.top
            var i1 = d3.bisectLeft(framenos, scaled_x, 1);
            var i0 = i1 - 1;
            var i = scaled_x - framenos[i0] > framenos[i1] - scaled_x ? i1 : i0;
            var value = Object.values(me._data)[i]['total']
            me.frameno = Object.keys(me._data)[i];  //Object.keys(freq).find(key => freq[key] === value);
            // console.log('--------------------------------------')
            // console.log('raw coordinate: ('+ mouse_coord_x +', '+ mouse_coord_y+')')
            // console.log('adjusted coordinate: ('+ adjusted_coord_x +', '+ adjusted_coord_y+')')
            // console.log('scaled coordinate: ('+ scaled_x +', '+ scaled_y+')')
            // console.log('value:'+value+', rank:'+me._rank)
            // console.log(me._data)
            
            // label for hover
            me.hover_point.attr('transform', `translate(${me.xScale(framenos[i])},${me.yScale(value)})`);
            me.hover_point.select('text').text('Frame#'+me.frameno+' ('+value+')');
            me.hover_point.attr('display', null);
            me.hover_point.moveToFront();

        }
        
        function clicked() {
            console.log('clicked: '+me.frameno)
            me.data.detailed_frame_no = me.frameno
            me.data.detailed_frame = me._data[me.frameno]
            console.log(me.data.detailed_frame)
            if (!me.frameview) {
                me.frameview = me.data.views.getView('frameview');
            }
            me.frameview._update();
        }
    }
    display_roi_labels() {
        var me = this;
        me.data.rank_of_interest.forEach(rank=>{
            if(!(rank in me.rank_of_interest_labels)) {
                me.rank_of_interest_labels[rank] = me.line_area.append('g')
                    .attr('class', 'streamview_roi_label')
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

    _updateCurrentView() {
        if (!this.currentview) {
            this.currentview = this.data.views.getView('currentview');
        }
        this.currentview._update(this._data[this.maxFrameNo]);
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};