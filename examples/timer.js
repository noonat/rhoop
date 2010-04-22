var Reactor = require('reactor').Reactor
  , stdout = java.lang.System.out;

var reactor = new Reactor();
reactor.delayCallback(5, function() {
    stdout.println('Oh! Hello, world!');
});
reactor.run();
