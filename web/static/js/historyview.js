class HistoryView extends View {
    constructor(data, svg) {
        super(data, svg, {
            'width': componentLayout.HISTORYVIEW_WIDTH,
            'height': componentLayout.HISTORYVIEW_HEIGHT
        });
        this.name = 'historyview'
        this.detailed = d3.select("#selected_rank_no");
        this.LINE_COLOR = 'steelblue'//'#ff8080'
        this.SELECTED_LINE_COLOR = 'steelblue'//'#ff8080'
        this.HOVER_LINE_COLOR = '#A8A3A3'//'#ff8080'
        this.NON_SELECTED_LINE_COLOR = '#A8A3A3'//'#ddd'
        this.xAxisLabel = 'Frame';
        this.yAxisLabel = '#. Anomaly';
        this._data = {};
        this.margin = {top: 20, right: 50, bottom: 30, left: 50};
        this.container_width = 1000;
        this.container_height = 500;
        this.content_width = this.container_width -this.margin.left -this.margin.right;
        this.content_height = this.container_height -this.margin.top -this.margin.bottom;
        this.rank_of_interest_labels = {};
        this.NUM_FRAME = 50
        this.svg
            .attr('class', 'historyview_svg')
            .attr('width', this.container_width)
            .attr('height', this.container_height);
        this.content_area = this.svg.append('g')
            .attr('class', 'historyview_content_area')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('width', this.content_width)
            .attr('height', this.content_height);
        this.xAxis = this.svg.append('g')
            .attr('class', 'historyview_x_axis')
            .attr('transform', 'translate('+this.margin.left+',' + (this.content_height+this.margin.top) + ')');
        this.yAxis = this.svg.append('g')
            .attr('class', 'historyview_y_axis')
            .attr('transform', 'translate('+this.margin.left+',' + this.margin.top + ')');

        var me = this
        this.dynamic = false;
        this.rangeStart = 0
        this.rank_no = d3.select("#history_start_no").node()
        d3.select("#static_btn").on("click", function(d) {
            me.dynamic = false
            me._update();
        });
        d3.select("#dynamic_btn").on("click", function(d) {
            me.dynamic = true
            me._update();
        });
    }

    stream_update(){
        /**
         * Called whenever data has received from backend.
         * Invokes rendering process if dynamic is set and the specific rank is selected.
        **/
        if( this.dynamic && this.data.rankHistoryInfo !== undefined) {
            this._update(this.data.rankHistoryInfo)
        }
    }

    _update(){
        /**
         * Renders delta plot after data converting and scales adjustment
        **/
        var rankInfo = this.data.rankHistoryInfo;
        this.fillColor = rankInfo.fill
        this.detailed.text('Selected Rank #: '+rankInfo.rank)
        this._data = this.getHistoryData(rankInfo.rank)
        this.adjust_scale();
        this.draw();
    }
    getHistoryData(rankno) {
        /**
         * Prepares proper format for rendering history view
         * 
         * the format is like below:
         * result == {
         *      frame_id: the number of anomalies of the specific rank
         * }
         */
        var res = {}
        var frames = this.data.history; // (from=='streamview')? this.data.renderingFrames:this.data.renderingFramesBottom
        for(var frameno in frames) {
            if(this.dynamic) { // consider window size
                if (frameno > (this.data.frameID-this.NUM_FRAME)) {
                    res[frameno] = frames[frameno][rankno]===undefined? 0: frames[frameno][rankno]
                }
            } else { // render from the beginning
                if (frameno >= this.rangeStart) {
                    res[frameno] = frames[frameno][rankno]===undefined? 0: frames[frameno][rankno]
                }
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
        this.xAxis.selectAll('text.historyview_xLabel').remove();
        this.yAxis.selectAll('text.historyview_yLabel').remove();
        this.axisBottom = d3.axisBottom(this.xScale);
        this.axisLeft = d3.axisLeft(this.yScale);
        this.xAxis.call(this.axisBottom).selectAll("text")
            .attr('transform', 'rotate(-90)')
            .attr('x', -15)
            .attr('y', -5)
        this.xAxis
            .append('text')
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
        this.content_area.selectAll('rect').remove() // remove
        var barData = this.getBarData();
        this.content_area.selectAll('rect')
            .data(barData).enter()
                .append("rect")
                .style("fill", this.fillColor)
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
                ).on('click', function(d) {
                    me.getExecutionsByTime(me.notify.bind(me), {
                        'rank': d.rank,
                        'start': 0,
                        'end': 0
                    });
                });
        this.bars = this.content_area.selectAll('historyview_bar');
    }
    getBarData() {
        var res = []
        Object.keys(this._data).forEach(rank => {
            res.push({
                'rank': Number(rank),
                'value': this._data[rank],
            })
        });
        return res;
    }
    getExecutionsByTime(callback, data) {
        fetch('/scatterplot', {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin"
        }).then(response => response.json()
            .then(json => {
                if (response.ok) {
                    callback(json);
                    return json
                } else {
                    return Promise.reject(json)
                }
            })
        )
        .catch(error => console.log(error));
    }
    notify(layout) {
        if (!this.scatterview) {
            this.scatterview = this.data.views.getView('scatterview');
        }
        this.scatterview.update(layout);
    }
}
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};