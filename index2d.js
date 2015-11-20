var $ = require('jquery');
var HOGView = require('./hog-view');

$( document ).ready(function() {
    var view1 = new HOGView({
        template : $( ".hogTemplate" ).text()
    });
    view1.render();
    
    $( '.view1' ).append( view1.el );
});
