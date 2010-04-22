var Reactor = require('reactor').Reactor
  , ByteBuffer = java.nio.ByteBuffer
  , InetSocketAddress = java.net.InetSocketAddress
  , ServerSocketChannel = java.nio.channels.ServerSocketChannel
  , stdout = java.lang.System.out;

var reactor = new Reactor();

var server = ServerSocketChannel.open();
server.configureBlocking(false);
server.socket().bind(new InetSocketAddress(7000), 5);
stdout.println('Listening on 127.0.0.1:7000');

var buffer = ByteBuffer.allocateDirect(1024);
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

reactor.run();
