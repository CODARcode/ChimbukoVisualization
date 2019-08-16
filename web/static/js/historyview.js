class HistoryView extends BarChartView {

    constructor(data, svg, name) {
        super(data, svg, name, {
            'width': componentLayout.HISTORYVIEW_WIDTH,
            'height': componentLayout.HISTORYVIEW_HEIGHT
        }, {
            'top': componentLayout.HISTORYVIEW_MARGIN_TOP, 
            'right': componentLayout.HISTORYVIEW_MARGIN_RIGHT, 
            'bottom': componentLayout.HISTORYVIEW_MARGIN_BOTTOM, 
            'left': componentLayout.HISTORYVIEW_MARGIN_LEFT
        });
        this.name = name
        this.rangeStart = 0
        this.dynamic = false;
        this.detailed = d3.select("#selected_rank_id");
        this.rank_no = d3.select("#history_start_no").node()
        this.NUM_FRAME = 50
        
        var me = this
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
    _update(selectedRankInfo, history){
        /**
         * Renders delta plot after data converting and scales adjustment
        **/
        
        this.detailed.text('Selected Rank #: '+selectedRankInfo.rank)
        this.processed = this.processData(selectedRankInfo.rank, history)
        this.render({
            'data': this.processed,
            'xLabel': 'Frame', 
            'yLebel': '# anomalies', 
            'color': {
                'fillColor': selectedRankInfo.fill
            }
        });
    }
    processData(selectedRankID, history) {
        /**
         * Process proper format for rendering 
         * Dynamically generate/process the given data to the expected format of barChart
         * format == {
         *      name of category == {
         *          x: [] # list of x values
         *          y: [] # list of y values
         *      }
         * }
         */
        var processed = {
            selectedRankID: {'x':[], 'y':[]}, // x: frames, y: # anomalies
        }
        var res = {}
        for(var frameID in history) {
            processed.selectedRankID.x.append(frameID)
            processed.selectedRankID.y.append(history[frameID])
        }
        return processed;
    }
    getScatterLayout(params) {
        var _callback = this.notify.bind(this)
        fetch('/scatterplot', {
            method: "POST",
            body: JSON.stringify(params),
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin"
        }).then(response => response.json()
            .then(json => {
                if (response.ok) {
                    _callback(json);
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

// get_y_max(d) {
    //     return Math.max(...Object.values(d));
    // }
    // adjust_scale() {
    //     this.xScale = d3.scaleBand().range([0, this.content_width]).domain(Object.keys(this.processed).map(Number)).paddingInner(0.05);
    //     this.yScale = d3.scaleLinear().range([this.content_height, 0]).domain([0, d3.max(Object.values(this.processed))]);
    // }
    // draw() {
    //     this._updateAxis();
    //     this._drawBars();
    // }
    // _updateAxis() {
    //     this.xAxis.selectAll('text.historyview_xLabel').remove();
    //     this.yAxis.selectAll('text.historyview_yLabel').remove();
    //     this.axisBottom = d3.axisBottom(this.xScale);
    //     this.axisLeft = d3.axisLeft(this.yScale);
    //     this.xAxis.call(this.axisBottom).selectAll("text")
    //         .attr('transform', 'rotate(-90)')
    //         .attr('x', -15)
    //         .attr('y', -5)
    //     this.xAxis
    //         .append('text')
    //             .attr('class', 'historyview_xLabel')
    //             .attr('x', this.content_width/2)
    //             .attr('y', 30)
    //             .style('text-anchor', 'middle')
    //             .text(this.xAxisLabel)
    //             .attr('fill', 'black')
    //             .style('font-weight', 'bold');
    //     this.yAxis.call(this.axisLeft)
    //         .append('text')
    //             .attr('class', 'historyview_yLabel')
    //             .attr('transform', 'rotate(-90)')
    //             .attr('y', -42)
    //             .attr('x', -this.content_height/2)
    //             .attr('dy', '.71em')
    //             .style('text-anchor', 'middle')
    //             .text(this.yAxisLabel)
    //             .attr('fill', 'black')
    //             .style('font-weight', 'bold');
    // }
    // _drawBars() {
    //     var me = this;
    //     me._rank = -1;
    //     this.content_area.selectAll('rect').remove() // remove
    //     var barData = this.getBarData();
    //     this.content_area.selectAll('rect')
    //         .data(barData).enter()
    //             .append("rect")
    //             .style("fill", this.fillColor)
    //             .attr("x", function(d) { 
    //                 // console.log('rank #: '+d.rank+', x: '+me.xScale(d.rank))
    //                 return me.xScale(d.rank)
    //             })
    //             .attr("width", me.xScale.bandwidth())
    //             .attr("y", function(d) { 
    //                 // console.log('value: '+d.value+', y: '+me.yScale(d.value))
    //                 return me.yScale(d.value)
    //             })
    //             .attr("height", function(d) { 
    //                 // console.log('content_height: '+me.content_height+', me.yScale(d.value): '+ me.yScale(d.value))
    //                 return me.content_height - me.yScale(d.value); }
    //             ).on('click', function(d) {
    //                 me.getScatterLayout(me.notify.bind(me), {
    //                     'rank': d.rank,
    //                     'start': 0,
    //                     'end': 0
    //                 });
    //             });
    //     this.bars = this.content_area.selectAll('historyview_bar');
    // }
    // getBarData() {
    //     var res = []
    //     Object.keys(this.processed).forEach(rank => {
    //         res.push({
    //             'rank': Number(rank),
    //             'value': this.processed[rank],
    //         })
    //     });
    //     return res;
    // }