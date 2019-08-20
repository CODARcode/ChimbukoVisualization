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
       var processed = this.processData(data);
       this.draw(processed);
       this.callback = callback;
    }

    processData(data) {
        var processed = {} 
        data.x.forEach(function(x, i) {
            processed[data.z[i]] = data.y[i]
        }) 
        return processed;
    }
    
    draw(renderData) {
        var me = this;
        
        var ranks = Object.keys(renderData)
        ranks.sort(function(x, y) {
            return d3.ascending(renderData[y], renderData[x]);
        })

        me.svg.selectAll('.'+this.name+'-item').remove();
        var legend = me.svg.selectAll('.'+this.name+'-item').data(ranks).enter()
            .append('div')
                .attr('class', this.name+'-item')
                .on('click', function(d) {
                    // var rankno = d
                    // console.log('clicked: '+rankno)
                    // me.selectedRankNo = rankno;
                    // me.data.rankHistoryInfo = {
                    //     'rank': rankno,
                    //     'fill': renderData[d].fill
                    // }
                    // if (!me.historyview) {
                    //     me.historyview = me.data.views.getView('historyview');
                    // }
                    // me.historyview._update();
                    // me.draw();
                    me.callback(d);
                });
        legend.append('div')
            .attr('class', this.name+'-item-circle')
            .style('background', function(d){
                return renderData[d].fill
            });
        legend.append('text')
            .attr('class', this.name+'-item-text')
            .style('color', function(d) {
                return (me.selectedRankNo=== d)? 'black':'gray';
            })
            .style('font-weight', function(d) {
                return (me.selectedRankNo=== d)? 'bold':'';
            })
            .text(function(d){
                return me.prefix + d +' ('+renderData[d]+')'
            })
    }
}
