class StreamView extends BarChartView {

    constructor(controller, svg, name) {
        super(controller, svg, name, {
            'width': componentLayout.STREAMVIEW_WIDTH,
            'height': componentLayout.STREAMVIEW_HEIGHT
        }, {
            'top': componentLayout.STREAMVIEW_MARGIN_TOP, 
            'right': componentLayout.STREAMVIEW_MARGIN_RIGHT, 
            'bottom': componentLayout.STREAMVIEW_MARGIN_BOTTOM, 
            'left': componentLayout.STREAMVIEW_MARGIN_LEFT
        }, {
            'xRoate': false
        });
        var me = this;
        me.name = name
        me.selectedRankID = -1;
        me.legendTop = new LegendView(me, d3.select('#'+me.name+'-legend'), me.name+'-legend', 'Rank ');
        me.legendBottom = new LegendView(me, d3.select('#'+me.name+'-legend-2'), me.name+'-legend-2', 'Rank ');

        me.streamSize = streamviewValues.DEFAULT_SIZE; // 10 by default
        me.streamSizeDom = d3.select('#streamview-size').on('change', function() {
            me.streamSize = me.streamSizeDom.node().value;
        });
        me.streamType = streamviewValues.DEFAULT_TYPE; // delta by default
        me.streamTypeDom = d3.select('#streamview-type').on('change', function() {
            me.streamType = me.streamTypeDom.node().value;
        });
        d3.select('#streamview-apply').on('click', function() {
            me.apply();
        });
    }
    getYLabel() {
        return streamviewValues[this.streamType]
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
        this.processed = this.controller.model.processStreamViewData(
                this.controller.model.selectedRanks.top, 
                this.controller.model.selectedRanks.bottom,
                this.controller.model.delta
            );
        this.render({
            'data': this.processed,
            'xLabel': streamviewValues.X_LABEL, 
            'yLabel': this.getYLabel(), 
            'color': {
                'colorScales': [this.controller.model.selectedRanks.top, this.controller.model.selectedRanks.bottom]
            },
            'callback': this.getHistory.bind(this)
        });
        this.updateLegend();
    }
    
    updateLegend() {
        this.legendTop.update(this.processed.top, this.getHistory.bind(this));
        this.legendBottom.update(this.processed.bottom, this.getHistory.bind(this));
    }
    
    getHistory(params) {
        var _params = {
            'rank_id': params.z,
            'app_id': -1, // placeholder
            'start': -1, // if either start or end is not set, then it is dynamic mode. 
            'size': historyviewValues.WINDOW_SIZE // if dynamic mode, retrive latest frames.
        };
        this.controller.model.selectedRankInfo = {
            'rank_id': params.z,
            'fill': params.fill
        }
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
            this.historyview = this.controller.views.getView('historyview');
        }
        this.historyview._update(data)
    }
    apply() {
        var me = this;
        fetch('/streamview_layout', {
            method: "POST",
            body: JSON.stringify({
                'size': me.streamSize,
                'type': me.streamType
            }),
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin"
        }).then(response => response.json()
            .then(json => {
                if (response.ok) {
                    console.log('streamview layout was successfully set.')
                    me.controller.model.setStreamSize(me.streamSize)
                } else {
                    return Promise.reject(json)
                }
            })
        )
        .catch(error => console.log(error));
    }
}
