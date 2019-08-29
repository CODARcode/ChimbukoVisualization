class HistoryView extends BarChartView {

    constructor(controller, svg, name) {
        super(controller, svg, name, {
            'width': componentLayout.HISTORYVIEW_WIDTH,
            'height': componentLayout.HISTORYVIEW_HEIGHT
        }, {
            'top': componentLayout.HISTORYVIEW_MARGIN_TOP, 
            'right': componentLayout.HISTORYVIEW_MARGIN_RIGHT, 
            'bottom': componentLayout.HISTORYVIEW_MARGIN_BOTTOM, 
            'left': componentLayout.HISTORYVIEW_MARGIN_LEFT
        }, {
            'xRotate': true
        });
        var me = this
        me.name = name
        me.dynamic = true;
        me.startFrameNo = 0
        me.NUM_FRAME = historyviewValues.WINDOW_SIZE;
        me.detailed = d3.select("#selected_rank_id");
        d3.select("#static_btn").on("click", function(d) {
            d3.select("#static_btn").style('font-weight', 'bold');
            d3.select("#dynamic_btn").style('font-weight', '');
            me.dynamic = false
            me.update();
        });
        d3.select("#dynamic_btn").style('font-weight', 'bold');
        d3.select("#dynamic_btn").on("click", function(d) {
            d3.select("#dynamic_btn").style('font-weight', 'bold');
            d3.select("#static_btn").style('font-weight', '');
            me.dynamic = true
            me.update();
        });
        d3.select("#historyview_prev").on("click", function(d) {
            if(!me.dynamic && me.startFrameNo>0) {
                me.startFrameNo -= historyviewValues.STEP;
                me.update();
            }
        });
        d3.select("#historyview_next").on("click", function(d) {
            if(!me.dynamic) {
                me.startFrameNo += historyviewValues.STEP;
                me.update();
            }
        });
    }
    stream_update(){
        /**
         * Called whenever data has received from backend.
         * Invokes rendering process if dynamic is set and the specific rank is selected.
        **/
        if( this.dynamic && this.controller.model.selectedRankInfo.rank_id !== undefined) {
            this.update()
        }
    }
    update() { 
        if(this.controller.model.selectedRankInfo.rank_id) {
            var param = {
                'rank_id': this.controller.model.selectedRankInfo.rank_id,
                'app_id': -1, // placeholder
                'start': this.startFrameNo, // if either start is not set, then it is dynamic mode. 
                'size': historyviewValues.WINDOW_SIZE // if dynamic mode, retrive latest frames.
            }
            if(this.dynamic) {
                param.start = -1
            }
            this.fetchHistory(param);    
        }
        
    }
    _update(data){
        /**
         * Renders delta plot after data converting and scales adjustment
        **/
        var selectedRankInfo = this.controller.model.selectedRankInfo;
        this.detailed.text(historyviewValues.SELECTED_RANK_PREFIX + selectedRankInfo.rank_id)
        this.processed = this.processData(selectedRankInfo.rank_id, data)
        this.render({
            'data': this.processed,
            'xLabel': historyviewValues.X_LABEL, 
            'yLabel': historyviewValues.Y_LABEL, 
            'color': {
                'fillColor': selectedRankInfo.fill
            },
            'callback': this.getScatterLayout.bind(this)
        });
    }
    processData(selectedRankID, data) {
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
        // console.log(history)
        var me = this;
        data.history.forEach(function(numAnomalies, frameID) {
            if (me.dynamic) {
                if (data.latest_id>=historyviewValues.WINDOW_SIZE) {
                    processed.selectedRankID.x.push(data.latest_id-historyviewValues.WINDOW_SIZE+frameID)
                } else {
                    processed.selectedRankID.x.push(me.startFrameNo+frameID)
                }
            } else {
                processed.selectedRankID.x.push(me.startFrameNo+frameID)
            }
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
            this.scatterview = this.controller.views.getView('scatterview');
        }
        this.scatterview.update(layout);
    }
    fetchHistory(params) {
        var callback = this._update.bind(this)
        fetch('/history', {
            method: "POST",
            body: JSON.stringify(params),
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
}
try {
    module.exports = History.processData;
} catch(e) {
    // no test mode.
}