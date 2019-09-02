class ScatterView extends View {
    constructor(data, svg, name) {
        super(data, svg, {
            'width': componentLayout.SCATTERVIEW_WIDTH,
            'height': componentLayout.SCATTERVIEW_HEIGHT
        });
        var me = this;
        me.name = name;
        me.color = me.vis.anomalyColor;
        me.margin = {
            top: componentLayout.SCATTERVIEW_MARGIN_TOP,
            right: componentLayout.SCATTERVIEW_MARGIN_RIGHT,
            bottom: componentLayout.SCATTERVIEW_MARGIN_BOTTOM,
            left: componentLayout.SCATTERVIEW_MARGIN_LEFT
        };
        me.x = d3.scaleLinear().range([me.margin.left, me.size.width - me.margin.right]);
        me.y = d3.scaleLinear().range([me.margin.top + 5, me.size.height - me.margin.bottom]);

        me.selections = new Set();
        me.dot = {};
        this._drawBackground();
        me.xAxis = me.svg.append("g")
            .attr("class", this.name+" x axis")    
            .attr("transform", "translate(0,"+(me.size.height - me.margin.bottom)+")")
        me.yAxis = me.svg.append("g")
            .attr("class", this.name+" y axis")
            .attr("transform", "translate("+me.margin.left+",0)")

        me.axis = [0, 1];
        me.sbox_x = d3.select("#sbox_x");
        me.sbox_y = d3.select("#sbox_y");
        me.btn = d3.select("#apply")
            .on("click", function(d) {
                me.axis[0] = me.sbox_x.node().value-0;
                me.axis[1] = me.sbox_y.node().value-0;
                me._update();
            });

        me.filter = {};
        me.legend_items = {};
        me.legend = d3.select("#"+this.name+"-legend");

        me.anomaly_only = false;
        me.cbox = d3.select("#"+this.name+"-cbox").on("click", function(d) {
            me.anomaly_only = me.cbox.node().checked;
            me._update();
        });
        
        me.filter_cbox = d3.select("#"+this.name+"-legend-filter").on("click", function(d) {
            me.filter_all = me.filter_cbox.node().checked;
            if(!me.filter_all) {
                me.filter = {}
            }
            me._update();
        });
        
        me.colorScale = d3.scaleOrdinal(d3.schemeCategory20c).domain(d3.range(0,19));
        me.formatSuffix = d3.format(".2s")
        me.layout = ["entry", "value", "comm ranks", "exit"]
    }

    stream_update(){
        /**
         * Scatterview won't be updated by "in-situ" mode.
         */
    }

    update(layout) {
        /**
         * Updates the results from In-Mem DB in the backend (Online Analysis MODE)
         */
        this.processLayout(layout);
        this._update();
    }

    _update(){
        this.selections.clear();
        this.clear();
        this._updateAxis();
        this.draw();
        this._zoom();
    }

    processLayout(layout) {
        var me = this;

        me._data = []
        me.coordinates = layout.coordinates;
        me.prog_names = layout.prog_names;
        me.func_names = layout.func_names;
        
        var latest_time = -1;
        layout.coordinates.forEach(function(d, i) { //load data to front end (scatter plot view)
            
            d[me.layout.indexOf('entry')] = d[me.layout.indexOf('entry')];
            d[me.layout.indexOf('exit')] = d[me.layout.indexOf('exit')];
            if (d[me.layout.indexOf('entry')]<0) {
                return 
            }
            latest_time = Math.max(latest_time, d[me.layout.indexOf('exit')]);// according to server, 3 is exit time
            me._data.push({
                "tid": -1, // <-- not generated yet
                "eid": layout.execution_id[i],
                "rid": layout.rank_id,
                "start": d[me.layout.indexOf('entry')],
                "end": d[me.layout.indexOf('exit')],
                "pos": d,
                "prog_name": layout.prog_names[i],
                "func_name": layout.func_names[i],
                "tree": null
            }); // <-- executions
        });
    }

    clear() {
        /**
         * Clear previous visualizations --> to be optimized for resusableness.
         **/
        this.legend_items = {}
        this.svg.selectAll("circle").remove();
        this.xAxis.selectAll("text.label").remove();
        this.yAxis.selectAll("text.label").remove();
    }
    
    draw(){
        var start = Date.now()
        this._drawAxis();
        this._drawDots();
        this._drawLegend()
        console.log('Scatterplot Rendering Time: '+ ((Date.now()-start)/1000))
        //this._drawPointLabel();
    }

    projectionChanged(){
        var me = this;
        me.transform = d3.zoomIdentity;    
        this.path.attr("d", "");
        me._updateAxis();

        this.dot
            .attr("cx", d => me.x(d.pos[me.axis[0]]))
            .attr("cy", d => me.y(d.pos[me.axis[1]]));
        this.textlabel
            .attr("x", d => me.x(d.pos[me.axis[0]]))
            .attr("y", d => me.y(d.pos[me.axis[1]]));
        if(this.controller.projectionMethod==1){
            me.svg.selectAll('.dotName').remove();
        }else{
            this._drawPointLabel();
        }
    }

    rightClick(){
        d3.event.preventDefault();
        this.controller.clearHight();
    }

    selected(){
    	this.dot
	    	.classed('selected',(d, i) => this.controller.isSelected(i));
    }
    unselected(){
        this.path.attr("d", "");
    	this.dot.classed("selected", false);
    }
    apply_filter(item) {
        var me = this;
        me.filter[item] = !(me.filter[item]);
        me.stream_update();
    }

    _drawPointLabel() {
        var me = this;

        me.svg.selectAll('.dotName').remove();

        var dotName = me.svg.selectAll('.dotName')
        	.data(me._data);
        dotName.exit().remove();
    }

    _drawAxis(){
        var titles = {"entry":"Entry Time", 'value': 'Execution Time', 'comm ranks':"Rank#.Thread#", "exit": "Exit Time"}
        var me = this;

        var pos_x = [];
        var pos_y = [];
        if(me.layout[me.axis[0]] == 'comm ranks'){
            me._data.forEach(function(d){
                pos_x.push(d.pos[me.axis[0]]);
            });
        }
        if(me.layout[me.axis[1]] == 'comm ranks'){
            me._data.forEach(function(d){
                pos_y.push(d.pos[me.axis[1]]);
            });
        }        
        var set_x = Array.from(new Set(pos_x));
        var set_y = Array.from(new Set(pos_y));

        var xAxis;
        if(me.layout[me.axis[0]] == 'comm ranks'){
            xAxis = this.xAxis
            .call(d3.axisBottom(me.x)
                .tickValues(set_x));
        }else{
            xAxis = this.xAxis
            .call(d3.axisBottom(me.x).tickFormat(function(d){
                if(me.layout[me.axis[0]] == 'entry' || me.layout[me.axis[0]] == 'exit'){
                    return parseFloat(d/1000000).toFixed(1)+"s";
                }else if(me.layout[me.axis[0]] == 'value'){
                    return parseFloat(d/1000).toFixed(1)+"ms";
                }else{
                    return d;
                }
            }))
        }
        xAxis.append("text")
            .attr("class", "label")
            .attr("x", me.size.width)
            .attr("y", -12)
            .text(titles[me.layout[me.axis[0]]])
            .attr("text-anchor", "end")
            .attr("fill", "black");

        var yAxis;
        if(me.layout[me.axis[1]] == 'comm ranks'){
            yAxis = this.yAxis
            .call(d3.axisLeft(me.y)
                .tickValues(set_y));
        }else{
            yAxis = this.yAxis
            .call(d3.axisLeft(me.y)
                .tickFormat(function(d){
                    if(me.layout[me.axis[1]] == 'entry' || me.layout[me.axis[1]] == 'exit'){
                        return parseFloat(d/1000000).toFixed(1)+"s";
                    }else if(me.layout[me.axis[1]] == 'value'){
                        return parseFloat(d/1000).toFixed(1)+"ms";
                    }else{
                        return d;
                    }
                }))
        }
        yAxis.append("text")
            .attr("class", "label")
            .attr("x", 2)
            .attr("y", 12)
            .text(titles[me.layout[me.axis[1]]])
            .attr("text-anchor", "start")
            .attr("fill", "black");
    }

    _drawDots() {
        var me = this;

        // compute progname and funcname sets
        var progname = me.prog_names;
        var funcname = me.func_names;
        var set_progname = Array.from(new Set(progname));
        var set_funcname = Array.from(new Set(funcname));
        //console.log(set_progname);
        //console.log(set_funcname);

        // Add the scatterplot
        me.dot = me.svg.selectAll("dot")
            .data(me._data)
            .enter()
            .filter(function(d) { 
                // if(me.rank_of_interest.has(d.pos[2])) {
                var lkey = "prog#"+d.prog_name+"-"+d.func_name;
                if (!me.legend_items[lkey]) {
                    me.legend_items[lkey] = {}
                    me._fillColor(d, set_progname, set_funcname)
                }
                if (me.filter_all) {
                    me.filter[lkey] = true;
                } 
                return !(me.filter[lkey])
                    // if (me.anomaly_only) {
                    //     return !(me.filter[lkey]) && (d.anomaly_score<0);
                    // } else {
                    //     return !(me.filter[lkey])
                    // }
                // }
            })
                .append("circle")
                .attr("r", 4)
                .attr("cx", d => me.x(d.pos[me.axis[0]]))
                .attr("cy", d => me.y(d.pos[me.axis[1]]))
                .attr("fill", d => me._fillColor(d, set_progname, set_funcname))
                .attr("fill-opacity", d => me._fillOpacity(d))
                .attr("stroke", 0);

        me.dot.on("click", function(d, i) {
            console.log('clicked eid:'+ d.eid);
                me.controller.setSelections(d);
            })
            .append("title")
            .text(function(d, i) {
                return d.func_name+"-prog#"+d.prog_name+"-execution#"+d['eid'];
            });
    }
    _fillColor(d, progname=[], funcname=[]){
        // five group, each with four lightness
        // if more than five functions, color repeats 
        // if more than four progs, lightness repeats
        var c = this.colorScale(funcname.indexOf(d.func_name)%5*4+d.prog_name%4);
        this.legend_items["prog#"+d.prog_name+"-"+d.func_name]['color'] = c;
        return c;
    }

    _clusterColor(d){
        return this.vis.clusterColor(d.cluster_label);
    }

    _fillOpacity(d){
        return 0.5; //d.anomaly_score>0?0.5:0.8;
    }

    changeColor(){
        this._resetDotLabel();
    }
    _resetDotLabel(){
        var me = this;

        if(me.vis.colorScheme == 0){
            this.dot
                .attr("fill", d => me._fillColor(d))
                .attr("fill-opacity", d => me._fillOpacity(d));
            this._drawPointLabel();//not t-sne
        }else{
            this.dot
                .attr("fill", d => me._clusterColor(d))
                .attr("fill-opacity", 0.5);
            me.svg.selectAll('.dotName').remove();
        }
    }
    _drawBackground(){
        var me = this;
        me.backgroud = me.svg.append('rect')
            .attr('x', me.x.range()[0])
            .attr('y', me.y.range()[0])
            .attr('width', me.x.range()[1] - me.x.range()[0])
            .attr('height', me.y.range()[1] - me.y.range()[0])
            .attr('stroke', '#000')
            .attr('stroke-width', 0)
            .style("fill", "white");
        me.backgroud.call(d3.zoom()
            .scaleExtent([1, 1000])
            .extent([[me.x.domain()[0],me.y.domain()[0]],[me.x.domain()[1],me.y.domain()[1]]])
            .on("zoom", function(){
                me._zoom();
            })
            );
        me.path = me.svg.append("path").attr("fill-opacity", 0.2);
    }

    _zoom(){
        var me = this;
        if (d3.event && d3.event.transform) {
            me.transform = d3.event.transform
        } 
        if (!me.transform){
            return
        } 
        var xrange = me.x.range();
        var yrange = me.y.range();
        var t = me.transform;
        if (t.applyX(xrange[0]) > xrange[0]){
            t.x =xrange[0] -xrange[0] * t.k;
        }else if(t.applyX(xrange[1]) < xrange[1]){
            t.x = xrange[1] - xrange[1] * t.k;
        }
        if (t.applyY(yrange[0]) > yrange[0]){
            t.y = yrange[0]-yrange[0] * t.k;
        }else if(t.applyY(yrange[1]) < yrange[1]){
            t.y = yrange[1] - yrange[1] * t.k;

        }
        me.xScale = t.rescaleX(me.x)
        me.yScale = t.rescaleY(me.y)
        this.dot
            .attr("cx", d => me.xScale(d.pos[me.axis[0]]))
            .attr("cy", d => me.yScale(d.pos[me.axis[1]]))
            .attr('fill-opacity', d => (me.xScale(d.pos[me.axis[0]])>xrange[1]||me.xScale(d.pos[me.axis[0]])<xrange[0])?0:me._fillOpacity(d))
            .attr('stroke-opacity', d => (me.xScale(d.pos[me.axis[0]])>xrange[1]||me.xScale(d.pos[me.axis[0]])<xrange[0])?0:me._fillOpacity(d));
        // this.textlabel
        //     .attr("x", d => new_xScale(d.pos.x))
        //     .attr("y", d => new_yScale(d.pos.y))
        //     .attr('opacity', d => (new_xScale(d.pos.x)>xrange[1]||new_xScale(d.pos.x)<xrange[0])?0:1);
        this.path.attr("transform", t);
    }

    _updateAxis(){
        var me = this;
        var xvalues = me.coordinates.map(function(elt) {
            return elt[me.axis[0]];
        });
        var yvalues = me.coordinates.map(function(elt) {
            return elt[me.axis[1]];
        });
        var ranges = {
            "xMax": Math.max.apply(null, xvalues),
            "xMin": Math.min.apply(null, xvalues),
            "yMax": Math.max.apply(null, yvalues),
            "yMin": Math.min.apply(null, yvalues),
        };
        ranges.xRange = ranges.xMax - ranges.xMin;
        ranges.yRange = ranges.yMax - ranges.yMin;

        // set the ranges
        me.x.domain([ranges.xMin - ranges.xRange / 15, ranges.xMax + ranges.xRange / 15]);
        me.y.domain([ranges.yMax + ranges.yRange / 50, ranges.yMin - ranges.yRange / 50]);
    }

    _drawLegend(ypos) {
        var me = this;
        me.legend.selectAll(".scatter-legend-item").remove();
        
        var names = Object.keys(me.legend_items)
        // names.sort(function(x, y) {
        //     x = x.replace(/ *\prog#[0-9]-*\ */g, "");
        //     y = y.replace(/ *\prog#[0-9]-*\ */g, "");
        //     return d3.ascending(me._data.stat[y]['abnormal'], me._data.stat[x]['abnormal']);
        // })
        var legend = me.legend.selectAll(".scatter-legend-item")
            .data(names)
            .enter()
            .append("div")
            .attr("class", "scatter-legend-item")
            .on("click", function(d) {
                d3.event.stopPropagation();
                if(me.filter_all) {
                    me.filter_all = undefined
                    me.filter_cbox.node().checked = false
                }
                me.apply_filter(d)
                this.style.color = me.filter[d]? "gray":"black"
            });
            
        legend.append("div")
            .attr("class", "scatter-legend-item-circle")
            .style("background", function(d){
                return me.legend_items[d]['color']
            });

        legend.append("text")
            .attr("class", "scatter-legend-item-text")
            .style("color", function(d) {
                if (me.filter_all) {
                    return "gray";
                } else {
                    return me.filter[d]?  "gray" : "black";
                }
            })
            .text(function(d){
                var prefix = (d+"([").match(/.+?(?=[\[\(])/)[0];
                var displayName = prefix.match(/(.*::)*(.*)/)[2];
                // var stat = me._data.stat[d.replace(/ *\prog#[0-9]-*\ */g, "")];
                // var ratio = stat['ratio']
                // if (ratio === undefined) {
                //     ratio = (stat['abnormal']/(stat['abnormal']+stat['regular'])) * 100
                // }
                // ratio = ratio.toFixed(2) + " %";
                // var anomaly = me.formatSuffix(stat['abnormal']);
                // var total = me.formatSuffix(stat['total']).replace('G', 'B') ;
                return displayName; //+": "+anomaly+"/"+total; //+ratio
            })
        me.filter_all = (me.filter_all === false)? undefined : me.filter_all;
    }
}
try {
    module.exports = ScatterView.processLayout;
} catch(e) {
    // no test mode.
}