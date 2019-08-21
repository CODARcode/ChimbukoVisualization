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
        this.detailed.text('Selected Rank #: '+selectedRankInfo.rank_id)
        this.processed = this.processData(selectedRankInfo.rank_id, history)
        this.render({
            'data': this.processed,
            'xLabel': 'Frame', 
            'yLebel': '# anomalies', 
            'color': {
                'fillColor': selectedRankInfo.fill
            },
            'callback': this.getScatterLayout.bind(this)
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
            selectedRankID: {'x':[], 'y':[], 'z':[]}, // x: frames, y: # anomalies
        }
        console.log(history)
        history.forEach(function(numAnomalies, frameID) {
            processed.selectedRankID.x.push(frameID)
            processed.selectedRankID.y.push(numAnomalies)
            processed.selectedRankID.z.push(selectedRankID)
        });
        return processed;
    }
    getScatterLayout(params) {
        var _params = {
            'rank_id': params.z,
            'app_id': -1, // placeholder
            'start': -1, // placeholder
            'end': -1 // placeholder
        };
        var _callback = this.notify.bind(this)
        fetch('/scatterplot', {
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
    notify(layout) {
        if (!this.scatterview) {
            this.scatterview = this.data.views.getView('scatterview');
        }
        this.scatterview.update(layout);
    }
}
