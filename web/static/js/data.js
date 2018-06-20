class Data {
    constructor(main) {
        //data
        this.data = [];
        this.selectedIds = [1];
        this.streaming();

        this.scoreThreshold = 0;
        this.clusterLoaded = false;
        //vis
        this.views = new Visualizations(this);
        this.views.init(this);
        this.views.addView(new DynamicGraphView(this, d3.select("#treeview")));
        this.views.addView(new TemporalView(this, d3.select("#temporalview")));
        this.views.addView(new ScatterView(this, d3.select("#overview")));

        this.k = visOptions.clusterk;
        this.eps = visOptions.clustereps;
        this.outlier_fraction = 0.02;
        this.projectionMethod = 0;
        this.scatterLayout = [];
    }

    streaming(){
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            var _json = jQuery.parseJSON(message.data);  
            console.log(_json['pos'].length); //+" "+_json['percent'])
            me.data = [];
            me.scatterLayout = _json['layout'];
            _json['pos'].forEach(function(d, i) { //load data to front end (scatter plot view)
                me.data.push({
                    "id": i,
                    "weight": 1,
                    "pos": {
                        'x': d[0],
                        'y': d[1]
                    },
                    "anomaly_score": _json['labels'][i],
                    "prog_name": _json['prog'][i],
                    "cluster_label": -1,
                    "relabel": 0, // manually labeled by the user 0 - unlabeled, 1 positive, -1 negative
                    "tree": null
                });
            });
            me.views.stream_update();
            if (_json["percent"] >= 1.0) {
                sse.close();
                sse = null;
                console.log("sse closed");            
            }
        };
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
        var index = options.id;
        if (me.data[index].tree) {
            callback(me.data[index].tree, options);
        } else {
            options.callback = callback;
            me.fetchWithCallback({
                'data': 'tree',
                'value': index
            }, me._saveTree.bind(me), options);
        }
    }

    _saveTree(json, options) {
        var me = this;
        var index = options.id;
        var callback = options.callback;

        var tree = me.data[index];
        tree.tree = json;
        tree.tree.id = index;
        tree.tree.nodes[0].level = 0;
        tree.tree.edges.forEach(function(d){
            tree.tree.nodes[d.target].level = tree.tree.nodes[d.source].level + 1;
        });
        //add a subtree list        
        callback(tree.tree, options);
    }

    switchProjection(method) {
        this.projectionMethod = method;
        this.data.forEach(function(d, i) {
            d.pos = d.projections[method];
        })
        this.views.projectionChanged();
    }
    relabel(label, indices) {
        var me = this;
        if (indices.length == 0) {
            indices = me.data.selectedIds;
        }
        indices.forEach(function(d) {
            me.data[d].relabel = label;
        })
        me.views.relabeled(indices);
    }
    relabelCLuster(label, clusterId){
        var indices = [];
        this.data.forEach(function(d, i){
            if(d.cluster_label==clusterId){
                d.relabel = label;
                indices.push(i)
            }
        });
        this.views.relabeled(indices);
    }

    train() {
        var positive = this.data
            .filter(d => d.relabel != -1)
            .map(d => d.id);
        console.log('request to train');
        console.log(positive);
        this.fetchWithCallback({
            data: 'relabel',
            value: {'samples':positive,'eps':this.eps,'k':this.k,'outlier_fraction':this.outlier_fraction}
        }, this._updateLearnedLabels.bind(this), {});
    }

    _updateLearnedLabels(response, options) {
        console.log("get response");
        var me = this;
        var outlierNum = Math.min(11,Math.ceil(this.outlier_fraction * response.length));

        me.scoreThreshold = response[outlierNum+1].score;
        var minscore = response[0].score;
        console.log("score range: "+minscore+" ~ "+response[response.length-1].score);
        me.views.scoreScale.domain([minscore,me.scoreThreshold,me.scoreThreshold,response[response.length-1].score])
        
        if(!me.clusterLoaded) this.clusters = {'-1':[]}

        response.forEach(function(d) {
            if(!me.clusterLoaded){
                me.data[d.id].cluster_label = d.cluster;
                if (d.cluster in me.clusters){
                    me.clusters[d.cluster].push(d.id);
                }else{
                    me.clusters[d.cluster] = [d.id];
                }
            }
            me.data[d.id].anomaly_score = d.score;
            if (d.score <= me.scoreThreshold && me.data[d.id].relabel == 0) {
                if (me.views.indexOf(d.id) == -1) {
                    me._getTree(me._addSmallMultiple.bind(me), {'id':d.id,'type':"anomaly",'svg':d3.select("#anomaly").append("svg:svg")});
                }
            }
        });
        
        if(false){//!me.clusterLoaded){
            var clusterlists = Object.keys(this.clusters).sort(function(a, b){return a-b});
            me.views.clusterColor.domain(clusterlists);
            clusterlists.forEach(function(d){
                if(d>=0){
                    me._getTree(me._addSmallMultiple.bind(me), {'id':me.clusters[d][0],'type':'clustering','svg':d3.select("#cluster").append("svg:svg")});
                }
            });
        }
        me.clusterLoaded = true;
        me.views.trained();
    }

    _addSmallMultiple(json, options){
        var me = this;
        var tree = me.data[json.id];
        if(options.type == 'clustering'){
            me.views.addView(new ClusterGraphView(me, options.svg, tree.tree));
        }else{
            me.views.addView(new CandidateGraphView(me, options.svg, tree.tree));
        }
    }

    _addCluster(json, options) {
        var me = this;
        var tree = me.data[json.id];
        me.views.addView(new ClusterGraphView(me, d3.select("#cluster").append("svg:svg"), tree.tree));
    }

    _addCandidate(json, options) {
        console.log(json.id)
        var me = this;
        var tree = me.data[json.id];
        me.views.addView(new CandidateGraphView(me, d3.select("#anomaly").append("svg:svg"), tree.tree));
    }

    setSelections(indices) {
        var me = this;
        this.selectedIds = indices;// now use the first, will update to the center
        if(this.selectedIds.length>0){
            me._getTree(me.views.selected.bind(me), {'id':me.selectedIds[0]});
        }
    }

    setClusterSelection(clusterId){
        var me = this;
        this.selectedIds = [];
        this.data.forEach(function(d, i){
            if(d.cluster_label==clusterId) me.selectedIds.push(i);
        });
        console.log("selected cluster "+clusterId+" and tree "+this.selectedIds[0]);

        if(this.selectedIds.length>0){
            me._getTree(me.views.selected.bind(me), {'id':me.selectedIds[0]});
        }
    }

    clearHight() {
        this.views.unselected();
    }

    getSelectedTree() {// now use the first, will update to the center
        return this.data[this.selectedIds[0]].tree;
    }

    isSelected(index) {
        return this.selectedIds.indexOf(index) != -1;
    }

    getScoreByIndex(index) {
        return (this.data[index].relabel == 0) ? (this.data[index].anomaly_score) : this.data[index].relabel;
    }
    getRelabelByIndex(index) {
        return this.data[index].relabel;
    }
    getClusterByIndex(index) {
        return this.data[index].cluster_label;
    }
    setParameters(k, eps){
        this.k = parseFloat(k);
        this.eps = parseFloat(eps);
    }

}