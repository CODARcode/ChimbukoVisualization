class Data {
    constructor(main) {
        //data
        this.data = [];
        this.selectedIds = [1];
        this.streaming();
        this.idx_offset = 0;//how many has poped out

        this.scoreThreshold = 0;
        this.clusterLoaded = false;
        //vis
        this.views = new Visualizations(this);
        this.views.init(this);
        // this.views.addView(new DynamicGraphView(this, d3.select("#treeview")));
        // this.views.addView(new TemporalView(this, d3.select("#temporalview")));
        // this.views.addView(new ScatterView(this, d3.select("#overview")));
        // this.views.addView(new GlobalView(this, d3.select("#globalview")));
        this.views.addView(new StreamView(this, d3.select("#deltaview"), 'deltaview'));
        this.views.addView(new StreamView(this, d3.select("#deltaview-bottom"), 'deltaview-bottom'));
        this.views.addView(new StreamView(this, d3.select("#streamview"), 'streamview'));
        this.views.addView(new StreamView(this, d3.select("#streamview-bottom"), 'streamview-bottom'));
        // this.views.addView(new FrameView(this, d3.select("#frameview")));
        // this.views.addView(new RankView(this, d3.select("#rankview")));
        this.views.addView(new HistoryView(this, d3.select("#historyview")));

        this.k = visOptions.clusterk;
        this.eps = visOptions.clustereps;
        this.outlier_fraction = 0.02;
        this.projectionMethod = 0;
        this.scatterLayout = [];
        this.stat = [];

        this.func_names = []
        this.prog_names = []
        this.initial_timestamp = -1
        this.prev_receive_time = -1
        this.global_rank_anomaly = {}
        this.rank_of_interest = new Set(); // by default

        this.SECOND = 1000 // ms
        this.delta = {};
        this.prev = {};
        this.frameID = 0;
        this.frameWindow = 30
        this.frameInterval = this.SECOND * 0.5
        this.frames = {};
        this.frames_bottom = {};
        this.renderingFrames = {};
        this.renderingFramesBottom = {};
        this.renderingDelta = {};
        this.renderingDeltaBottom = {};
        this.selectedFrames = []
        this.date = new Date();
        this.setWait = true;
        this.NUM_SELECTION_RANK = 10;
        this.history = {};
        this.rendering();
    }

    streaming(){
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            console.log('['+me.date.toLocaleTimeString()+'] streaming()');
            var d = jQuery.parseJSON(message.data);  
            var frames = d['stream']
            me.delta = d['delta'];
            me._update(frames, me.delta);
        };
    }

    _update(frames, delta) {
        // this.selectedRanks = this.getOutlierRanks(delta)
        // console.log(this.selectedRanks)
        for(var rank in frames) { // aggregate frames
            // if(this.selectedRanks[0].includes(rank)) {
                if(!this.frames[rank]) {
                    this.frames[rank] = []
                }
                this.frames[rank] = this.frames[rank].concat(frames[rank])
            // } 
            // else if(this.selectedRanks[1].includes(rank)) {
                // if(!this.frames_bottom[rank]) {
                //     this.frames_bottom[rank] = []
                // }
                // this.frames_bottom[rank] = this.frames_bottom[rank].concat(frames[rank])
            // }
        }
        
    }

    getOutlierRanks(delta) {
        var ranks = Object.keys(delta)
        var deltaValues = Object.values(delta);
        var sortedRanks = deltaValues.map((d, i) => [ranks[i], d]) 
                        .sort(([r1, d1], [r2, d2]) => d2 - d1) 
                        .map(([r, d]) => r); 
        var top;
        var bottom;
        if( sortedRanks.length < 10 ) {
            var m = Math.floor((sortedRanks.length)/2)
            top = sortedRanks.slice(0, m)
            bottom = sortedRanks.slice(m)
        } else {
            top = sortedRanks.slice(0, this.NUM_SELECTION_RANK)
            bottom = sortedRanks.slice(sortedRanks.length-this.NUM_SELECTION_RANK)
        }
        console.log('top:'+top.length+', bottom:'+bottom.length)
        return [top, bottom] 
    }
    
    rendering() {
        console.log('['+this.date.toLocaleTimeString()+'] rendering()');
        if(this.makeRenderingFrames()){
            // console.log('Frame: '+this.frameID)
            // console.log(this.renderingFrames)
            this.views.stream_update();
            this.frameID += 1;
            this.frameInterval = this.SECOND * 0.5
        } else {
            this.frameInterval = this.SECOND * 2
        }
        setTimeout(this.rendering.bind(this), this.frameInterval);
    }

    makeRenderingFrames() {
        // console.log('['+this.date.toLocaleTimeString()+'] makeRenderingFrames()');
        var delta = this.updateDelta();
        console.log(delta)
        this.selectedRanks = this.getOutlierRanks(delta)
        console.log(this.selectedRanks)
        var res = false;
        var rawFrame = this.frames//[type]
        for ( var rank in rawFrame) {
            var rankData = rawFrame[rank]
            if (rankData.length > 0) {
                var value = rankData.splice(0, 1)[0]
                if(this.selectedRanks[0].includes(rank)) {
                    res = true;
                    if (Object.keys(this.renderingFrames).length == this.frameWindow) {
                        delete this.renderingFrames[this.frameID-this.frameWindow] 
                    }
                    if (Object.keys(this.renderingDelta).length == this.frameWindow) {
                        delete this.renderingDelta[this.frameID-this.frameWindow] 
                    }
                    if (!this.renderingFrames[this.frameID]) {
                        this.renderingFrames[this.frameID] = {}
                    }
                    if (!this.renderingDelta[this.frameID]) {
                        this.renderingDelta[this.frameID] = {}
                    }
                    this.renderingDelta[this.frameID][rank] = this.delta[rank]
                    this.renderingFrames[this.frameID][rank] = value;
                }
                if(this.selectedRanks[1].includes(rank)) {
                    res = true;
                    if (Object.keys(this.renderingFramesBottom).length == this.frameWindow) {
                        delete this.renderingFramesBottom[this.frameID-this.frameWindow] 
                    }
                    if (Object.keys(this.renderingDeltaBottom).length == this.frameWindow) {
                        delete this.renderingDeltaBottom[this.frameID-this.frameWindow] 
                    }
                    if (!this.renderingFramesBottom[this.frameID]) {
                        this.renderingFramesBottom[this.frameID] = {}
                    }
                    if (!this.renderingDeltaBottom[this.frameID]) {
                        this.renderingDeltaBottom[this.frameID] = {}
                    }
                    this.renderingDeltaBottom[this.frameID][rank] = this.delta[rank]
                    this.renderingFramesBottom[this.frameID][rank] = value;
                }
                if (!this.history[this.frameID]) {
                    this.history[this.frameID] = {}
                }
                this.history[this.frameID][rank] = value;
            }
        }
        return res;
    }

    updateDelta() {
        var delta = {}
        for ( var rank in this.frames) {
            var rankData = this.frames[rank];
            if (rankData.length > 0) {
                var curr = rankData[0];
                if(this.delta[rank] === undefined) {
                    this.delta[rank] = 0
                    delta[rank] = 0
                } else {
                    delta[rank] = this.delta[rank]
                }
                if (this.prev[rank] === undefined){
                    this.prev[rank] = 0
                }
                var value = Math.abs(curr - this.prev[rank])
                delta[rank] += value
                this.delta[rank] += value
                this.prev[rank] = curr
            } 
            // else {
            //     delete this.delta[rank]
            // }
        }
        return delta
    }

    fetchWithCallback(data, callback, options) {
        fetch('/tree', {
                method: "POST",
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin"

            }).then(response => response.json()
                .then(json => {
                    if (response.ok) {
                        callback(json, options);
                        return json
                    } else {
                        return Promise.reject(json)
                    }
                })
            )
            .catch(error => console.log(error));
    }

    _getTree(callback, options) {
        var me = this;
        var index = options.id-me.idx_offset;
        if (me.data[index].tree) {
            callback(me.data[index].tree, options);
        } else {
            options.callback = callback;
            me.fetchWithCallback({
                'data': 'tree',
                'value': options.id,
                'eid': options.eid
            }, me._saveTree.bind(me), options);
        }
    }

    _saveTree(json, options) {
        var me = this;
        var index = options.id-me.idx_offset;
        var callback = options.callback;

        var tree = me.data[index];
        tree.tree = json;
        tree.tree.id = options.id;
        tree.tree.nodes[0].level = 0;
        tree.tree.edges.forEach(function(d){
            tree.tree.nodes[d.target].level = tree.tree.nodes[d.source].level + 1;
        });
        //add a subtree list        
        callback(tree.tree, options);
    }
    setSelections(indices) {
        var me = this;
        this.selectedIds = indices;// now use the first, will update to the center
        if(this.selectedIds.length>0){
            me._getTree(me.views.selected.bind(me), {
                'id':me.selectedIds[0],
                'eid': me.selectedIds[1]
            });
        }
    }

    clearHight() {
        this.views.unselected();
    }

    getSelectedTree() {// now use the first, will update to the center
        return this.data[this.selectedIds[0]-this.idx_offset].tree;
    }

    isSelected(index) {
        return this.selectedIds.indexOf(index+this.idx_offset) != -1;
    }

    getScoreByIndex(index) {
        index-=this.idx_offset;
        return (this.data[index].relabel == 0) ? (this.data[index].anomaly_score) : this.data[index].relabel;
    }

    setSamplingRate(rate) {
        fetch('/srate', {
            method: "POST",
            body: JSON.stringify(rate),
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin"
        }).then(response => response.json()
            .then(json => {
                if (response.ok) {
                    return json
                } else {
                    return Promise.reject(json)
                }
            })
        )
        .catch(error => console.log(error));
    }
}