class StreamView extends BarChartView {

    constructor(data, svg, name) {
        super(data, svg, name, {
            'width': componentLayout.STREAMVIEW_WIDTH,
            'height': componentLayout.STREAMVIEW_HEIGHT
        }, {
            'top': componentLayout.STREAMVIEW_MARGIN_TOP, 
            'right': componentLayout.STREAMVIEW_MARGIN_RIGHT, 
            'bottom': componentLayout.STREAMVIEW_MARGIN_BOTTOM, 
            'left': componentLayout.STREAMVIEW_MARGIN_LEFT
        });
        this.name = name
        this.legend = d3.select('#'+this.name+'-legend');
        this.legend2 = d3.select('#'+this.name+'-legend-2');
    }
    stream_update(){
        /**
         * If received data, the In-Situ update is invoked.
        **/
        this._update()
    }
    _update(){
        /**
         * Renders delta plot after data converting and scales adjustment
        **/
        this.processed = this.processData();
        this.render({
            'data': this.processed,
            'xLabel': 'Ranking', 
            'yLebel': 'Accum. # delta', 
            'color': {
                'colorScales': [this.data.selectedRanks.top, this.data.selectedRanks.bottom]
            },
            'callback': this.getHistory.bind(this)
        });
    }
    processData() {
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
            'top': {'x':[], 'y':[], 'z':[]}, // x: ranking, y: accum. # delta, z: rank_id
            'bottom': {'x':[], 'y':[], 'z':[]} // x: ranking, y: accum. # delta, z: rank_id  
        }
        var top = this.data.selectedRanks.top
        var bottom = this.data.selectedRanks.bottom
        var maxLength = Math.max(top.length, bottom.length) 
        for (var i=0; i<maxLength; i++) {
            if(top[i] !== undefined) {
                processed.top.x.push(i)
                processed.top.y.push(this.data.delta[top[i]])
                processed.top.z.push(top[i])
            }
            if(bottom[i] !== undefined) {
                processed.bottom.x.push(i)
                processed.bottom.y.push(this.data.delta[bottom[i]])
                processed.bottom.z.push(bottom[i])
            }
        }
        return processed;
    }
    getHistory(params) {
        var _params = {
            'rank_id': params.z,
            'app_id': -1, // placeholder
            'start': -1, // placeholder
            'end': -1 // placeholder
        };
        var _callback = this.notify.bind(this)
        fetch('/history', {
            method: "POST",
            body: JSON.stringify(_params),
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
    notify(data) {
        /**
         *  Notify new data to update historyview
         * */
        if (!this.historyview) {
            this.historyview = this.data.views.getView('historyview');
        }
        this.historyview._update(data)
    }
}

// getLegendData() {
//     var cat1 = {}
//     var cat2 = {}
//     this.barData.forEach(d => {
//         if (d.type==0) {
//             cat1[d.name] = d
//         } else {
//             cat2[d.name] = d
//         }
//     })
//     return [cat1, cat2];
// }
// _drawLegend() {
//     var me = this;
//     me.legend.selectAll('.'+this.name+'-legend-item').remove();
//     me._legend.selectAll('.'+this.name+'-legend-item').remove();
//     this.legendData = this.getLegendData()
//     this.makeLegend(me.legend, this.legendData[0])
//     this.makeLegend(me._legend, this.legendData[1])
// }

// makeLegend(target, legendData) {
//     var me = this;
//     var ranks = Object.keys(legendData)
//     ranks.sort(function(x, y) {
//         return d3.ascending(legendData[y].value, legendData[x].value);
//     })
//     var legend = target.selectAll('.'+this.name+'-legend-item').data(ranks).enter()
//         .append('div')
//             .attr('class', this.name+'-legend-item')
//             .on('click', function(d) {
//                 var rankno = d
//                 console.log('clicked: '+rankno)
//                 me.selectedRankNo = rankno;
//                 me.data.rankHistoryInfo = {
//                     'rank': rankno,
//                     'fill': legendData[d].fill
//                 }
//                 if (!me.historyview) {
//                     me.historyview = me.data.views.getView('historyview');
//                 }
//                 me.historyview._update();
//                 me.draw();
//             });
//     legend.append('div')
//         .attr('class', this.name+'-legend-item-circle')
//         .style('background', function(d){
//             return legendData[d].fill
//         });
//     legend.append('text')
//         .attr('class', this.name+'-legend-item-text')
//         .style('color', function(d) {
//             return (me.selectedRankNo=== d)? 'black':'gray';
//         })
//         .style('font-weight', function(d) {
//             return (me.selectedRankNo=== d)? 'bold':'';
//         })
//         .text(function(d){
//             return 'MPI Rank ID: '+d+' ('+legendData[d].value+')'
//         })
// }
