var $ = require('jquery');
var _ = require('underscore');
var HOGView = require('./hog-view');
var View = require('ampersand-view');

var EigenvalueView = View.extend({
    initialize : function(attr, options)
    {
        View.prototype.initialize.call(this, attr, options);        

        this.view1 = attr.view1;
        this.view2 = attr.view2;
        this.view3 = attr.view3;

        this.view1.on("change:histogram", _.bind(this.updateMetrics, this));
        this.view2.on("change:histogram", _.bind(this.updateMetrics, this));
        this.view3.on("change:histogram", _.bind(this.updateMetrics, this));
    },
    updateMetrics: function(e)
    {
        var count =  0;

        if(typeof(this.view1.histogram) == "undefined") count++;
        if(typeof(this.view2.histogram) == "undefined") count++;
        if(typeof(this.view3.histogram) == "undefined") count++;

        if(count > 0)
        {
            $( this.el ).find( '.msg' ).text( "Need " + count + " more images to do the 3d analysis");
            return;
        }
        else
        {
            $( this.el ).find( '.msg' ).text("");
        }

        var histogram1 = new Float64Array(this.view1.histogram.length);
        var histogram2 = new Float64Array(this.view1.histogram.length);
        var histogram3 = new Float64Array(this.view1.histogram.length);

        for(var i = 0; i < histogram1.length; i++)
        {
            histogram1[i] = this.view1.histogram[i];
            histogram2[i] = this.view2.histogram[i];
            histogram3[i] = this.view3.histogram[i];
        }

        var dt = 2.0 * Math.PI / histogram1.length;

        var integrate = function(hist) {
            var total = 0.0;

            for(var i = 0; i < hist.length; i++)
            {
                if(i < hist.length - 1)
                {
                    total += hist[i + 1] * dt + hist[i] * dt / 2.0
                }
                else
                {
                    total += hist[0] * dt + hist[i] * dt / 2.0
                }
            }

            return total;
        }

        total = integrate(histogram1) + integrate(histogram2) + integrate(histogram3);

        maxArea = Math.max(this.view1.width * this.view1.height, this.view2.width * this.view2.height, this.view3.width * this.view3.height)

        for(var i = 0; i < histogram1.length; i++)
        {
            histogram1[i] /= total * this.view1.width * this.view1.height / maxArea;
            histogram2[i] /= total * this.view2.width * this.view2.height / maxArea;
            histogram3[i] /= total * this.view3.width * this.view3.height / maxArea;
        }

        var thetas = new Float64Array(histogram1.length);
        var xs = new Float64Array(histogram1.length);
        var ys = new Float64Array(histogram1.length);

        for(var i = 0; i < histogram1.length; i++)
        {
            thetas[i] = i * dt + dt / 2.0;

            xs[i] = Math.cos(thetas[i]);
            ys[i] = Math.sin(thetas[i]);
        }

        var Ixx = integrate(histogram1);
        var Iyy = integrate(histogram2);
        var Izz = integrate(histogram3);

        for(var i = 0; i < histogram1.length; i++)
        {
            histogram1[i] *= -(xs[i] * ys[i]);
            histogram2[i] *= -(xs[i] * ys[i]);
            histogram3[i] *= -(xs[i] * ys[i]);
        }

        var Iyz = integrate(histogram1);
        var Ixz = integrate(histogram2);
        var Ixy = integrate(histogram3);

        var M = [[Ixx, Ixy, Ixz],
                 [Ixy, Iyy, Iyz],
                 [Ixz, Iyz, Izz]];

        result = numeric.eig(M);

        var e = result.lambda.x;

        e.sort();

        $( this.el ).find( '.e1v' ).text(e[0]);
        $( this.el ).find( '.e2v' ).text(e[1]);
        $( this.el ).find( '.e3v' ).text(e[2]);
    },

    render: function()
    {
        this.renderWithTemplate();
        return this;
    }
});

$( document ).ready(function() {
    var view1 = new HOGView({
        template : $( ".hogTemplate" ).text()
    });
    view1.render();
    
    var view2 = new HOGView({
        template : $( ".hogTemplate" ).text()
    });
    view2.render();

    var view3 = new HOGView({
        template : $( ".hogTemplate" ).text()
    });
    view3.render();

    var view4 = new EigenvalueView({
        template : $( ".hog3dTemplate" ).text(),
        view1 : view1,
        view2 : view2,
        view3 : view3
    });

    view4.render();
    
    $( '.view1' ).append( view1.el );
    $( '.view2' ).append( view2.el );
    $( '.view3' ).append( view3.el );
    $( '.3d' ).append( view4.el );
});
