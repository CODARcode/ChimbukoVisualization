class LegendView extends View {

    constructor(data, svg, name) {
        
    }

    stream_update(){
       
    }

    _update(){
       
    }

    processData() {
        
    }
    
    getLegendData() {
        var cat1 = {}
        var cat2 = {}
        this.barData.forEach(d => {
            if (d.type==0) {
                cat1[d.name] = d
            } else {
                cat2[d.name] = d
            }
        })
        return [cat1, cat2];
    }
    _drawLegend() {
        var me = this;
        me.legend.selectAll('.'+this.name+'-legend-item').remove();
        me._legend.selectAll('.'+this.name+'-legend-item').remove();
        this.legendData = this.getLegendData()
        this.makeLegend(me.legend, this.legendData[0])
        this.makeLegend(me._legend, this.legendData[1])
    }

    makeLegend(target, legendData) {
        var me = this;
        var ranks = Object.keys(legendData)
        ranks.sort(function(x, y) {
            return d3.ascending(legendData[y].value, legendData[x].value);
        })
        var legend = target.selectAll('.'+this.name+'-legend-item').data(ranks).enter()
            .append('div')
                .attr('class', this.name+'-legend-item')
                .on('click', function(d) {
                    var rankno = d
                    console.log('clicked: '+rankno)
                    me.selectedRankNo = rankno;
                    me.data.rankHistoryInfo = {
                        'rank': rankno,
                        'fill': legendData[d].fill
                    }
                    if (!me.historyview) {
                        me.historyview = me.data.views.getView('historyview');
                    }
                    me.historyview._update();
                    me.draw();
                });
        legend.append('div')
            .attr('class', this.name+'-legend-item-circle')
            .style('background', function(d){
                return legendData[d].fill
            });
        legend.append('text')
            .attr('class', this.name+'-legend-item-text')
            .style('color', function(d) {
                return (me.selectedRankNo=== d)? 'black':'gray';
            })
            .style('font-weight', function(d) {
                return (me.selectedRankNo=== d)? 'bold':'';
            })
            .text(function(d){
                return 'MPI Rank ID: '+d+' ('+legendData[d].value+')'
            })
    }
    
}
