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
        this.views.addView(new StreamView(this, d3.select("#streamview")));
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
        this.frameID = 0;
        this.frameWindow = 30
        this.frameInterval = this.SECOND * 0.5
        this.frames = {};
        this.renderingFrames = {};
        this.selectedFrames = []
        this.date = new Date();
        this.setWait = true;
        this.NUM_SELECTION_RANK = 10;
        this.rendering();
    }

    streaming(){
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            console.log('['+me.date.toLocaleTimeString()+'] streaming()');
            var d = jQuery.parseJSON(message.data);  
            var frames = d['stream']
            var delta = d['delta'];
            me._update(frames, delta)
        };
    }

    _update(frames, delta) {
        this.selectedRanks = this.getOutlierRanks(delta)
        // console.log(this.selectedRanks)
        for(var rank in frames) { // aggregate frames
            if(this.selectedRanks[0].includes(rank)) {
                if(!this.frames[rank]) {
                    this.frames[rank] = []
                }
                this.frames[rank] = this.frames[rank].concat(frames[rank])
            } 
            // else if(this.selectedRanks[1].includes(rank)) {
            //     if(!this.frames.bottom[rank]) {
            //         this.frames.bottom[rank] = []
            //     }
            //     this.frames.bottom[rank] = this.frames.bottom[rank].concat(frames[rank])
            // }
        }
        // console.log(this.frames)
    }

    getOutlierRanks(delta) {
        var ranks = Object.keys(delta)
        var deltaValues = Object.values(delta);
        var sortedRanks = deltaValues.map((d, i) => [ranks[i], d]) 
                        .sort(([r1, d1], [r2, d2]) => d2 - d1) 
                        .map(([r, d]) => r); 
        var m = this.NUM_SELECTION_RANK
        var top
        var bottom
        if( sortedRanks.length < 10 ) {
            m = Math.floor((sortedRanks.length-1)/2)
            top = sortedRanks.slice(0, m)
            bottom = sortedRanks.slice(m)
        } else {
            top = sortedRanks.slice(0, m)
            // bottom = sortedRanks.slice(sortedRanks.length-5)
            // top = ranks.slice(0, 3) // Test
            // bottom = ranks.slice(ranks.length-1) // Test
        }
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
        var res = false;
        // for (var type in this.frames) {
            var rawFrame = this.frames//[type]
            for ( var rank in rawFrame) {
                var rankData = rawFrame[rank]
                if (rankData.length > 0) {
                    res = true;
                    var value = rankData.splice(0, 1)[0]
                    if (Object.keys(this.renderingFrames).length == this.frameWindow) {
                        delete this.renderingFrames[this.frameID-this.frameWindow] 
                    }
                    if (!this.renderingFrames[this.frameID]) {
                        this.renderingFrames[this.frameID] = {}
                    }
                    this.renderingFrames[this.frameID][rank] = value;
                } 
            }
        // }
        return res;
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