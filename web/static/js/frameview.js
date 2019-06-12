class FrameView extends View {
    constructor(data, svg) {
        super(data, svg, {});
        this.name = 'frameview'
        this.detailed = d3.select("#detailed_frame_info");
        this.LINE_COLOR = 'steelblue'//'#ff8080'
        this.SELECTED_LINE_COLOR = 'steelblue'//'#ff8080'
        this.HOVER_LINE_COLOR = '#A8A3A3'//'#ff8080'
        this.NON_SELECTED_LINE_COLOR = '#A8A3A3'//'#ddd'
        this.xAxisLabel = 'Rank';
        this.yAxisLabel = '#. Anomaly';
        this._data = {};
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 750;
        this.container_height = 300;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.rank_of_interest_labels = {};
        this.svg
            .attr('class', 'frameview_svg')
            .attr('width', this.container_width)
            .attr('height', this.container_height);
        this.content_area = this.svg.append('g')
            .attr('class', 'frameview_content_area')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('width', this.content_width)
            .attr('height', this.content_height);
        this.xAxis = this.svg.append('g')
            .attr('class', 'frameview_x_axis')
            .attr('transform', 'translate('+this.margin.left+',' + (this.content_height+this.margin.top) + ')');
        this.yAxis = this.svg.append('g')
            .attr('class', 'frameview_y_axis')
            .attr('transform', 'translate('+this.margin.left+',' + this.margin.top + ')');
        var me = this
        this.rangeStart = 0
        this.numVisibleRanks = 10
        this.rank_no = d3.select("#detail_start_no").node()
        this.rank_no_btn = d3.select("#fbtn").on("click", function(d) {
            me.rangeStart = Number(me.rank_no.value)
            me._update();
        });
    }
    stream_update(){
        // this.detailed.text('Selected Frame #: '+this.data.detailed_frame_no)
        // this._data = this.data.detailed_frame
        // delete this._data['total']
        // this.adjust_scale();
        // this.draw();
    }
    _update(){
        this.detailed.text('Selected Frame #: '+this.data.detailed_frame_no)
        this._data = this.getRange(this.data.detailed_frame)
        delete this._data['total']
        this.adjust_scale();
        this.draw();
    }
    getRange(_data) {
        var res = {}
        for (var i=0; i<this.numVisibleRanks; i++) { 
            var cnt = this.rangeStart + i
            if (_data[cnt]>-1) {
                res[cnt] = _data[cnt]
            }
        }
        return res
    }
    get_y_max(d) {
        return Math.max(...Object.values(d));
    }
    adjust_scale() {
        this.xScale = d3.scaleBand().range([0, this.content_width]).domain(Object.keys(this._data).map(Number)).paddingInner(0.05);
        this.yScale = d3.scaleLinear().range([this.content_height, 0]).domain([0, d3.max(Object.values(this._data))]);
    }
    draw() {
        this._updateAxis();
        this._drawBars();
    }
    _updateAxis() {
        this.xAxis.selectAll('text.frameview_xLabel').remove();
        this.yAxis.selectAll('text.frameview_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom).selectAll("text")
            .attr('transform', 'rotate(-90)')
            .attr('y', -5)
            .attr('x', -15)
        this.xAxis
            .append('text')
                .attr('class', 'frameview_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 30)
                .style('text-anchor', 'middle')
                .text(this.xAxisLabel)
                .attr('fill', 'black')
                .style('font-weight', 'bold');
        this.yAxis.call(this.axisLeft)
            .append('text')
                .attr('class', 'frameview_yLabel')
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
        this.content_area.selectAll('rect').remove() // remove
        var barData = this.getBarData();
        this.content_area.selectAll('rect')
            .data(barData).enter()
                .append("rect")
                .style("fill", "steelblue")
                .attr("x", function(d) { 
                    // console.log('rank #: '+d.rank+', x: '+me.xScale(d.rank))
                    return me.xScale(d.rank)
                })
                .attr("width", me.xScale.bandwidth())
                .attr("y", function(d) { 
                    // console.log('value: '+d.value+', y: '+me.yScale(d.value))
                    return me.yScale(d.value)
                })
                .attr("height", function(d) { 
                    // console.log('content_height: '+me.content_height+', me.yScale(d.value): '+ me.yScale(d.value))
                    return me.content_height - me.yScale(d.value); }
                );
        this.bars = this.content_area.selectAll('frameview_bar');
    }
    getBarData() {
        var res = []
        Object.keys(this._data).forEach(rank => {
            res.push({
                'rank': Number(rank),
                'value': this._data[rank],
            })
        });
        console.log(res)
        return res;
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};