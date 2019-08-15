class BarChartView extends View {

    constructor(data, svg, name, size, margin, callback) {
        super(data, svg, size);
        this.name = name
        this.margin = margin;
        this.container_width = size.width;
        this.container_height = size.height;
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

        this.callback = callback;
    }
    stream_update(){
        /**
         * Overwrittened by child component
        **/
    }
    _update(){
        /**
         * Overwrittened by child component
        **/
    }
    processData(data) {
        /**
         * Overwrittened by child compoennt
         * Dynamically generate/process the given data to the following expected format:
         * format == {
         *      name of category == {
         *          x: [] # list of x values
         *          y: [] # list of y values
         *      }
         * }
         */
    }
    render(xLabel, yLabel, data) {
        this.renderData = data
        this.setAxisLabels(xLabel, yLabel);
        this.adjust_scale();
        this.draw();
    }
    setAxisLabels(xAxis, yAxis) {
        /**
         * Set x, y axis labels 
        **/
        this.xAxisLabel = xAxis;
        this.yAxisLabel = yAxis;
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
        this.xScale = d3.scaleBand().range([0, this.content_width]).domain(Object.keys(this.renderData).map(this.getX)).paddingInner(0.05);
        this.yScale = d3.scaleLinear().range([this.content_height, 0]).domain([0, d3.max(Object.values(this.renderData).map(this.getYMax))]);
        this.topColorScale = d3.scaleSequential().domain([0, d3.max(Object.values(this.renderData).map(this.getTopMax))]).interpolator(d3.interpolateReds); //interpolateReds , interpolateYlOrRd
        this.bottomColorScale = d3.scaleSequential().domain([0, d3.max(Object.values(this.renderData).map(this.getBottomMax))]).interpolator(d3.interpolateBlues); //interpolateBlues , interpolateGnBu
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
                ).on('click', d => this.callback(d));
        this.bars = this.content_area.selectAll(this.name+'_bar');
    }
    getBarData() {
        var res = []
        Object.keys(this.renderData).forEach(i => {
            if (this.renderData[i].category1 !== undefined) {
                res.push({
                    'class': Number(i),
                    'name': Number(this.renderData[i].category1.name),
                    'value': this.renderData[i].category1.value,
                    'fill': this.topColorScale(Number(this.renderData[i].category1.name)+7.5),
                    'type': 0
                });
            }
            if (this.renderData[i].category2 !== undefined) {
                res.push({
                    'class': Number(i),
                    'name': Number(this.renderData[i].category2.name),
                    'value': this.renderData[i].category2.value,
                    'fill': this.bottomColorScale(Number(this.renderData[i].category2.name)+7.5),
                    'type': 1
                });
            }
        });
        return res;
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};