class Controller {
    constructor(main) {
        /**
         * Controller object based on MCV design pattern
         * manages model (data) and view (visualizations) 
         */
        
        // Controller Properties
        this.selectedExecution = [1];
        this.date = new Date();
        this.SECOND = 1000 // ms
        this.frameInterval = this.SECOND * 0.5
        
        // Initialize View components
        this.views = new Visualizations(this);
        this.views.init(this);
        this.views.addView(new DynamicGraphView(this, d3.select("#treeview")));
        this.views.addView(new TemporalView(this, d3.select("#temporalview")));
        this.views.addView(new ScatterView(this, d3.select("#overview"), 'scatterview'));
        this.views.addView(new StreamView(this, d3.select("#streamview"), 'streamview'));
        this.views.addView(new HistoryView(this, d3.select("#historyview"), 'historyview'));

        // Initialize Model components
        this.model = new Model();
        
        this.streaming(); // keep listening data event from backend application
        this.rendering(); // keep drawing if data is available.
    }

    rendering() {
        /**
         * Keep watching if the data has received,
         *  if so, renders view components every 0.5 sec.
         *  else, wait next 2 sec.
         */
        console.log('['+this.date.toLocaleTimeString()+'] rendering() ');
        if(this.model.hasReceived()){
            this.views.stream_update();
            this.frameID += 1; // maintains frame id for frontend
            this.frameInterval = this.SECOND * 0.5
        } else {
            this.frameInterval = this.SECOND * 2
        }
        setTimeout(this.rendering.bind(this), this.frameInterval);
    }

    streaming(){
        /**
         * If data has pushed from backend, the callback of EventSource is invoked
         * Receives delta and processed data
         *  stream == {
         *      rank_id = list of the number of anomalies per rank
         *   }
         * 
         *  "delta" from backend is deprecated (currently calculated in frontend side)
         *  to reflect the changes at the moment whenever the plot is drawed.
         */
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            console.log('['+me.date.toLocaleTimeString()+'] received data');
            var d = jQuery.parseJSON(message.data);  
            me.model.update(d['stream']);
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

    _getTree(callback, execution) {
        var me = this;
        if (execution.tree) {
            callback(execution.tree, execution);
        } else {
            execution.callback = callback;
            me.fetchWithCallback({
                'type': 'tree',
                'tid': execution.tid,
                'eid': execution.eid,
                'rid': execution.rid,
                'start': execution.start,
                'end': execution.end
            }, me._saveTree.bind(me), execution);
        }
    }

    _saveTree(json, execution) {
        var callback = execution.callback;
        execution.tree = json;
        execution.tree.id = execution.eid;
        execution.tree.nodes[0].level = 0;
        execution.tree.edges.forEach(function(d){
            execution.tree.nodes[d.target].level = execution.tree.nodes[d.source].level + 1;
        });
        //add a subtree list        
        this.selectedExecution = execution
        callback(execution.tree, execution);
    }

    setSelections(execution) {
        var me = this;
        this.selectedExecution = execution.eid;// now use the first, will update to the center
        me._getTree(me.views.selected.bind(me), execution);
    }

    clearHight() {
        this.views.unselected();
    }

    getSelectedTree() {// now use the first, will update to the center
        console.log(this.selectedExecution.tree);
        return this.selectedExecution.tree;
    }

    isSelected(index) {
        return this.selectedExecution == index;
    }

    getScoreByIndex(index) {
        index-=this.idx_offset;
        return (this.model.data[index].relabel == 0) ? (this.model.data[index].anomaly_score) : this.model.data[index].relabel;
    }

}