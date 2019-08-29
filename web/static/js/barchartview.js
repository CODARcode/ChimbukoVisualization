class BarChartView extends View {

    constructor(data, svg, name, size, margin, option) {
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
        this.option = option;
        this.colorTheme = [d3.interpolateReds, d3.interpolateBlues] 
        this.globalColorMap = {};
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
    render(params) {
        this.renderData = params.data;
        this.callback = params.callback;
        this.setAxisLabels(params.xLabel, params.yLabel);
        this.adjustScale(params.color);
        this.draw();
    }
    setAxisLabels(xLabel, yLabel) {
        /**
         * Set x, y axis labels 
        **/
        this.xAxisLabel = xLabel;
        this.yAxisLabel = yLabel;
    }
    getXMax(d) {
        return d3.max(d.x)
    }
    getXMin(d) {
        return d3.min(d.x)
    }
    getY(d) {
        return d3.max(d.y)
    }
    getColor(d) {
        return Number(d);
    }
    adjustScale(color) { 
        var me = this;
        me.xScale = d3.scaleBand().range([0, me.content_width]).domain(d3.range(d3.min(Object.values(me.renderData).map(me.getXMin)), d3.max(Object.values(me.renderData).map(me.getXMax))+1)).paddingInner(0.05);
        me.yScale = d3.scaleLinear().range([me.content_height, 0]).domain([0, d3.max(Object.values(me.renderData).map(me.getY))]);
        if(color.colorScales)  {
            me.colorScaleFuncs = []
            me.colorScales = color.colorScales;
            color.colorScales.forEach(function(d, i) {
                me.colorScaleFuncs.push(d3.scaleSequential()
                    .domain([-5, d3.max(Object.values(d).map(me.getColor))+5])
                    .interpolator(me.colorTheme[i]))
            });
        } else {
            me.fillColor = color.fillColor
        }
    }
    draw() {
        this._updateAxis();
        this._drawBars();
    }
    _updateAxis() {
        this.xAxis.selectAll('text.'+this.name+'_xLabel').remove();
        this.yAxis.selectAll('text.'+this.name+'_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        if (this.option.xRotate) {
            this.xAxis.call(this.axisBottom).selectAll('text')
                .attr('transform', 'rotate(-90)')
                .attr('x', -15)
                .attr('y', -5)
        } else {
            this.xAxis.call(this.axisBottom)
        }
        this.xAxis.append('text')
                .attr('class', this.name+'_xLabel')
                .attr('x', this.content_width/2)
                .attr('y', 27)
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
        this.barWidth = me.xScale.bandwidth()/Object.keys(this.renderData).length;
        this.content_area.selectAll('rect')
            .data(this.barData).enter()
                .append("rect")
                .style("fill", d => d.fill)
                .attr("x", function(d) { // to be side by side
                    return me.xScale(d.x) + (d.categoryNumber*me.barWidth)
                })
                .attr("width", me.barWidth)
                .attr("y", function(d) { 
                    return me.yScale(d.y)
                })
                .attr("height", function(d) { 
                    return me.content_height - me.yScale(d.y); 
                })
                .on('click', function(d) {
                    me.callback(d)
                });
        this.bars = this.content_area.selectAll(this.name+'_bar');
    }
    getBarData() { 
        var res = []
        var me = this;
        Object.keys(this.renderData).forEach(function(category, i) {
            var barData = me.renderData[category]
            // console.log(category, me.renderData[category])
            barData.x.forEach(function(x, j) {
                var fillColor;
                if (me.colorScaleFuncs) {
                    fillColor = me.colorScaleFuncs[i](Number(me.colorScales[i][j]))
                } else {
                    fillColor = me.fillColor;
                }
                res.push({
                    'x': x,
                    'y': barData.y[j],
                    'z': barData.z[j],
                    'fill': fillColor,
                    'categoryNumber': Number(i),
                    'categoryName': category
                });
                me.globalColorMap[Number(barData.z[j])] = fillColor;
            });
        });
        return res;
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};