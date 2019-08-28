class Model {
    constructor(main) {
        /**
         * Model object based on MCV design pattern
         * handles overall data processing for frontend view components
         */

        //data
        this.data = [];
        this.selected_eid = [1];
        this.idx_offset = 0;//how many has poped out
        
        this.scatterLayout = [];
        this.stat = [];

        this.func_names = []
        this.prog_names = []
        this.initial_timestamp = -1
        this.prev_receive_time = -1
        this.global_rank_anomaly = {}

        this.delta = {};
        this.prev = {};
        this.frameID = 0;
        this.frameWindow = 30
        
        this.frames = {};
        
        this.setWait = true;
        this.NUM_SELECTION_RANK = 10;
        this.history = {};
        this.selectedExecution = {};
        this.selectedRankInfo = {};

    }
    update(stream) {
        /**
         * concat new array to the corresponding array based on the rank
         */
        for(var rank in stream) { 
            if(!this.frames[rank]) {
                this.frames[rank] = []
            }
            this.frames[rank] = this.frames[rank].concat(stream[rank]) 
        }
    }
    getSortedRanks(delta) {
        /**
         * Sorts delta values per rank 
         * Get top and bottom 5 ranks based on delta values
         */
        var ranks = Object.keys(delta)
        var deltaValues = Object.values(delta);
        var sortedRanks = deltaValues.map((d, i) => [ranks[i], d]) 
                        .sort(([r1, d1], [r2, d2]) => d2 - d1) 
                        .map(([r, d]) => r); 
        var top;
        var bottom;
        if( sortedRanks.length < (this.NUM_SELECTION_RANK*2) ) {
            var m = Math.floor((sortedRanks.length)/2) // adjust the number of ranks is under 10
            top = sortedRanks.slice(0, m)
            bottom = sortedRanks.slice(m)
        } else {
            top = sortedRanks.slice(0, this.NUM_SELECTION_RANK)
            bottom = sortedRanks.slice(sortedRanks.length-this.NUM_SELECTION_RANK)
        }
        return {
            'top': top,
            'bottom': bottom
        }
    }
    hasReceived() {
        /**
         * Return true if possible to process
         * If possible, 
         *      Gets the first element, the number of anomalies, from each list of rank
         *      Considers only top and bottom sorted ranks
         */
        // var curr_delta = this.updateDelta();
        this.updateDelta();
        this.selectedRanks = this.getSortedRanks(this.delta)
        var res = false;
        for ( var rank in this.frames) {
            var rankData = this.frames[rank]
            if (rankData.length > 0) {
                var value = rankData.splice(0, 1)[0]
                if(this.selectedRanks.top.includes(rank) || this.selectedRanks.bottom.includes(rank)) {
                    res = true;
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
        /**
         * Calculate delta in the frontend side 
         * so that the delta can be calculated more frequently.
         */
        // var curr_delta = {}
        for ( var rank in this.frames) {
            var rankData = this.frames[rank];
            if (rankData.length > 0) {
                var curr = rankData[0];
                if(this.delta[rank] === undefined) {
                    this.delta[rank] = 0
                    // curr_delta[rank] = 0
                } else {
                    // curr_delta[rank] = this.delta[rank]
                }
                if (this.prev[rank] === undefined){
                    this.prev[rank] = 0
                }
                var value = Math.abs(curr - this.prev[rank])
                // curr_delta[rank] += value
                this.delta[rank] += value
                this.prev[rank] = curr
            } 
            // else {
            //     delete this.delta[rank]
            // }
        }
        // return curr_delta
    }
    getRankIDList () {
        return Object.keys(this.frames)
    }
}
try {
    module.exports = Model;
} catch(e) {
    // no test mode.
}


