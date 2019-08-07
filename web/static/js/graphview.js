class GraphView extends View {
    constructor(data, svg, size, margin) {
        super(data, svg, {
            'width': componentLayout.DYNAMIC_GRAPH_VIEW_WIDTH,
            'height': componentLayout.DYNAMIC_GRAPH_VIEW_HEIGHT
        });
        var me = this;
        this.color = d3.scaleOrdinal(d3.schemeCategory20).domain(d3.range(0,19)); //me.vis.functionColor;
        me.margin = margin;
        me.scale = 1;
        me.sizeCoef = visOptions.graphSizeCoef;
        me.repelCoef = visOptions.graphRepelCoef;
        var repelForce = d3.forceManyBody().strength(d=>me.repelCoef*this._radius(d.value)).distanceMax(100);
        me.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().iterations(2).id(d => d.id))
            .force("charge", repelForce)
            .force("center", d3.forceCenter((me.size.width - me.margin.right + me.margin.left) / 2, me.size.height / 2))
            .stop()

        me.linksvg = me.svg.append("g")
            .attr("class", "links");
        me.nodesvg = me.svg.append("g")
            .attr("class", "nodes")
        me.baseline = d3.select("#baselineview").append("g")
            .attr("class", "baseline")
        me.drag = d3.drag();
        me.idRect = me.svg.append('rect');
        me.idText = me.svg.append("text")
            .attr("x", 2)
            .attr("y", 11);
        me.graph = null;
        me.maxLevel = 4;
        this.defs = me.svg.append("defs");
        this.defs.append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -3 6 6")
            .attr("refX", 6)
            .attr("refY", 0)
            .attr("markerWidth", 3)
            .attr("markerHeight", 3)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-3L6,0L0,3")
            .style("fill", "#999");
    }

    _radius(value){
        return Math.sqrt(value/visOptions.valueCoef) / this.sizeCoef + 1.5;
    }
    _distance(source, target){
        return Math.sqrt((target.x - source.x)*(target.x - source.x)+(target.y - source.y)*(target.y - source.y));
    }

    _setGraph(tree){
        var me = this;
        me.graph = tree;
        me.graphId = tree.id;
        me.graph.nodes.forEach(function(d) {
            d.value = Math.max(1, d.value);
            d.r = me._radius(d.value);
        });
    }

    _anomalyColor(){
        var score = this.vis.scoreScale(this.data.getScoreByIndex(this.graphId));
        return this.vis.anomalyColor(score);
    }

    _drawTreeId(){
        var me = this;
        if(me.graphId == -1){
            return;
        }
        var nameColor = me._anomalyColor();
        var l = d3.hsl(nameColor).l;
        me.idText.text("Prog#"+me.graph.prog_name+"-Rank#"+me.graph.node_index+"-Thread#"+me.graph.threads+"-Tree#"+me.graph.graph_index)
            .attr('fill', (l<0.7)?'white':'black');
        var bbox = me.idText.node().getBBox();
        me.idRect.attr('x',bbox.x-2)
            .attr('y',bbox.y)
            .attr('width',bbox.width+4)
            .attr('height',bbox.height)
            .attr('fill', nameColor);
    }

    _drawGraph(){
        var me = this;
        me.link = me.linksvg
            .selectAll("line")
            .data(me.graph.edges)
            .enter()
            .append("line")
            .attr("stroke-width", 1)
            .attr("stroke", "#999");
        var levelCount = []
        me.graph.nodes.forEach(function(d){
            while(levelCount.length<=d.level){
                levelCount.push(0);
            }
            levelCount[d.level]++;
        });
        me.maxLevel = levelCount.length;
        var nodeSum = 0;
        var nodeLimit = 20;
        for(var i = 0; i<levelCount.length; i++){
            nodeSum += levelCount[i];
            if(nodeSum>nodeLimit){
                me.maxLevel = i;
                break;
            }
        }
        console.log("max depth for the selected tree visualization: "+me.maxLevel);

        me.node = me.nodesvg
            .selectAll("circle")
            .data(me.graph.nodes)
            .enter()
            .filter(function(d) {
                return d.level < me.maxLevel || !d.hide;
            })
            .append("circle")
            .attr("r", d => {
                return d.r/me.scale
            })
            .attr("fill", d => me.getColor(d.name))
            .attr('stroke', 'red')
            .attr('stroke-width', '1px')
            .call(me.drag)
            .on("click", function(d) {
                try {

                    me.baseline.selectAll("g").remove();
                    
                    var fname = d.name
                    var prefix = (fname+"([").match(/.+?(?=[\[\(])/)[0];
                    var displayName = prefix.match(/(.*::)*(.*)/)[2];
                    
                    var fill = me.getColor(fname)
                    var mean = me.data.stat[fname].mean
                    if(mean<0) {
                        console.log('mean value was not given.')
                        mean = d.value * (2/3)
                        // return 
                    } else {
                        mean = Math.round(me.data.stat[fname].mean)
                    }
                    var std = me.data.stat[fname].std 
                    if(std<0) {
                        console.log('std value was not given.')
                        std = d.value * (1/10)
                        // return 
                    }
                    var minimum = Math.round(mean -3*std)
                    var maximum = Math.round(mean +3*std)
                    
                    // if(mean<0 || std<0 || minimum < 0) {
                    if(minimum < 0) {    
                        console.log('Incorrect statistics was given.')
                    } 

                    var rad = d.r/me.scale // given anomaly
                    var mean_rad = me._radius(mean)/me.scale
                    var minimum_rad = me._radius(minimum)/me.scale
                    var maximum_rad = me._radius(maximum)/me.scale

                    var standard_rad = 35// rad to standard
                    var largest_rad = Math.max(rad, mean_rad, minimum_rad, maximum_rad)
                    
                    var adjusted_rad = rad * (standard_rad/largest_rad)
                    var adjusted_mean_rad = mean_rad * (standard_rad/largest_rad)
                    var adjusted_minimum_rad = minimum_rad * (standard_rad/largest_rad)
                    var adjusted_maximum_rad = maximum_rad * (standard_rad/largest_rad)
                    
                    var svg_width = 800
                    var cell_size = Math.max(210, ((standard_rad*2)+standard_rad))
                    var cell_1_start = 0 // svg_width-(cell_size*2)
                    var cell_2_start = cell_size // svg_width-(cell_size+(cell_size/2))

                    var cell_1 = me.baseline
                        .append('g')
                        .attr('class', 'baseline_cell')
                    cell_1.append('text')
                        .attr("x", cell_1_start+5) 
                        .attr("y", 20)
                        .style("font-size", "16px")
                        .style("font-weight", "bold")
                        .text(displayName)
                    cell_1.append('text')
                        .attr("x", cell_1_start+5) 
                        .attr("y", 40)
                        .style("font-size", "12px")
                        .text('Execution Time: '+parseFloat(d.value/1000).toFixed(1)+' ms')
                    cell_1.append('rect')
                        .attr('x', cell_1_start)
                        .attr('y', 0)
                        .attr('width', cell_size)
                        .attr('height', cell_size-30)
                        .style('stroke', 'black')
                        .style("fill", "none")
                        .style('stroke-width', '1px')
                    cell_1.append('circle')
                        .attr('cx', cell_size/2)
                        .attr('cy', cell_size/2 + 10)
                        .attr("r", adjusted_rad)
                        .style("fill", fill)
                        .style('stroke-width', '1px')
                    var cell_2 = me.baseline
                        .append("g")
                        .attr('class', 'baseline_cell')
                    cell_2.append('text')
                        .attr("x", cell_2_start+5)
                        .attr("y", 20)
                        .style("font-size", "16px")
                        .style("font-weight", "bold")
                        .text('Statistics of Execution')
                    cell_1.append('text')
                        .attr("x", cell_2_start+5) 
                        .attr("y", 40)
                        .style("font-size", "12px")
                        .text('Mean Execution Time: '+parseFloat(mean/1000).toFixed(1)+' ms')
                    cell_1.append('text')
                        .attr("x", cell_2_start+5) 
                        .attr("y", 60)
                        .style("font-size", "12px")
                        .text('Estimated Range: '+parseFloat(minimum/1000).toFixed(1)+' - '+parseFloat(maximum/1000).toFixed(1) + ' (ms)')
                    cell_2.append('rect')
                        .attr('x', cell_2_start)
                        .attr('y', 0)
                        .attr('width', cell_size)
                        .attr('height', cell_size-30)
                        .style('stroke', 'black')
                        .style("fill", "none")
                        .style('stroke-width', '1px')
                    cell_2.append('circle')
                        .attr('cx', cell_size+(cell_size/2))
                        .attr('cy', cell_size/2 + 10)
                        .attr("r", adjusted_mean_rad)
                        .style("fill", fill)
                        .style('stroke-width', '1px')
                    cell_2.append('circle')
                        .attr('cx', cell_size+(cell_size/2))
                        .attr('cy', cell_size/2 + 10)
                        .attr("r", adjusted_minimum_rad)
                        .style("fill", 'none')
                        .style("stroke", "black")
                        .style("stroke-dasharray", "4,1")
                        .style('stroke-width', '1px')
                    cell_2.append('circle')
                        .attr('cx', cell_size+(cell_size/2))
                        .attr('cy', cell_size/2 + 10)
                        .attr("r", adjusted_maximum_rad)
                        .style("fill", 'none')
                        .style("stroke", "black")
                        .style("stroke-dasharray", "4,1")
                        .style('stroke-width', '1px')
                } catch(e) {
                    console.log(e)
                }
            })
        me.node.append("title").text(d => d.name);
    }

    _simulate(){
        throw new Error('abstract method!');
    }

    draw() {
        this._drawGraph();
        this._simulate();
    }

    getMean(fname) {
        if (this.data.stat[fname]) {
            return this.data.stat[fname].mean
        } else {
            return d.value
        }
    }
}