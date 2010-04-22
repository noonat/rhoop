If I'm doomed to stay on the Dark Island, I might as well make the best of it.

# rhoop

rhoop is an event loop class for Rhino, inspired by libev (and node's use of
libev). It doesn't provide any stream or network abstraction (yet), so you
still need to use Java classes when appropriate.

## Running standalone

If you add the `bin` folder to your path, you can run scripts with:

    rhoop test.js
    
Or with a shebang:

    #!/usr/bin/env rhoop
    java.lang.System.out.println("Hello, world!");

## Running from within Rhino

You can also use it from within a normal Rhino shell, as long as you include
`rhoop.jar` in the classpath:

    $ java -cp js.jar:rhoop.jar org.mozilla.javascript.tools.shell.Main

    Rhino 1.7 release 3 PRERELEASE 2010 04 07
    js> context = org.mozilla.javascript.Context.getCurrentContext();
    js> org.rhoop.Rhoop.load(context, this, []);
    js> Reactor = rhoop.require('reactor').Reactor;
    js> reactor = new Reactor();
    js> reactor.nextTick(function() {
      >     print("ohai");
      > });
    js> reactor.run();
    ohai
    js> 

## Examples

Example echo server:

    var Reactor = require('reactor').Reactor
      , ByteBuffer = java.nio.ByteBuffer
      , InetSocketAddress = java.net.InetSocketAddress
      , ServerSocketChannel = java.nio.channels.ServerSocketChannel
      , stdout = java.lang.System.out;

    var reactor = new Reactor();

    var buffer = ByteBuffer.allocateDirect(1024);
    var server = ServerSocketChannel.open();
    server.configureBlocking(false);
    server.socket().bind(new InetSocketAddress(7000), 5);
    stdout.println('Listening on 127.0.0.1:7000');
    reactor.channelCallbacks(server, {
        acceptable: function() {
            var client = server.accept();
            client.configureBlocking(false);
            var watcher = reactor.channelCallbacks(client, {
                readable: function() {
                    buffer.clear();
                    var bytesRead = client.read(buffer);
                    if (bytesRead > 0) {
                        buffer.flip();
                        client.write(buffer);
                    } else if (bytesRead === -1) {
                        client.close();
                        watcher.stop();
                    }
                }
            });
        }
    });

    reactor.run();  // this will block

## License 

(The MIT License)

Copyright (c) 2010 Nathan Ostgard &lt;no@nathanostgard.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
