class LegendView extends View {

    constructor(data, svg, name, prefix) {
        super(data, svg, {
            'width': componentLayout.LEGENDVIEW_WIDTH,
            'height': componentLayout.LEGENDVIEW_HEIGHT
        });
        this.name = name;
        this.prefix = prefix;
    }

    update(data, callback){
        this.processed = this.processData(data);
        this.callback = callback;
        this.draw();
    }

    processData(data) {
        var processed = {} 
        data.x.forEach(function(x, i) {
            processed[data.z[i]] = data.y[i]
        }) 
        return processed;
    }
    
    draw() {
        var me = this;
        var renderData = this.processed;
        var ranks = Object.keys(renderData)
        ranks.sort(function(x, y) {
            return d3.ascending(renderData[y], renderData[x]);
        });
        me.svg.selectAll('.legendview-item').remove();
        var legend = me.svg.selectAll('.'+this.name+'-item').data(ranks).enter()
            .append('div')
                .attr('class', 'legendview-item')
                .on('click', function(d) {
                    me.controller.selectedRankID = d
                    me.callback({
                        'z': d,
                        'fill': me.controller.globalColorMap[Number(d)]
                    });
                    me.controller.updateLegend();
                });
        legend.append('div')
            .attr('class', 'legendview-item-circle')
            .style('background', function(d){
                return me.controller.globalColorMap[Number(d)]
            });
        legend.append('text')
            .attr('class', 'legendview-item-text')
            .style('color', function(d) {
                return (me.controller.selectedRankID === d)? 'black':'gray';
            })
            .style('font-weight', function(d) {
                return (me.controller.selectedRankID === d)? 'bold':'';
            })
            .text(function(d){
                return me.prefix + d +' ('+renderData[d]+')'
            })
    }
}
