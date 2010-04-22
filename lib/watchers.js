var reactor = require('reactor');

// Watcher is a dumb listener. It always returns true as long as it's active
// and has a callback. It is used for idle callbacks and the like.
function Watcher(reactor, callback) {
    this.active = false;
    this.reactor = reactor;
    this.callback = callback;
};
exports.Watcher = Watcher;

Watcher.prototype.invoke = function() {
    this.callback(this);
};

Watcher.prototype.pending = function(reactor) {
    return this.active && this.callback;
};

Watcher.prototype.start = function() {
    if (!this.active) {
        this.active = true;
        this.reactor.addWatcher(this);
    }
    return this;
};

Watcher.prototype.stop = function() {
    if (this.active) {
        this.active = false;
        this.reactor.removeWatcher(this);
    }
    return this;
};


// DelayedWatcher is a relative timer (e.g. it triggers after a number of
// seconds from now). It stops itself after triggering once.
function DelayedWatcher(reactor, delay, callback) {
    Watcher.call(this, reactor, callback);
    this.time = reactor.time + delay;
    this.delay = delay;
};
exports.DelayedWatcher = DelayedWatcher;
DelayedWatcher.prototype = Object.create(Watcher.prototype);

DelayedWatcher.prototype.invoke = function() {
    Watcher.prototype.invoke.call(this);
    this.stop();
};

DelayedWatcher.prototype.pending = function() {
    if (this.reactor.time >= this.time) {
        return Watcher.prototype.pending.call(this);
    } else {
        return false;
    }
};


// ScheduledWatcher is an absolute timer (e.g. it triggers itself when
// reactor.time is >= a given time). It stops itself after triggering once.
function ScheduledWatcher(reactor, time, callback) {
    Watcher.call(this, reactor, callback);
    this.time = time;
};
exports.ScheduledWatcher = ScheduledWatcher;
ScheduledWatcher.prototype = Object.create(Watcher.prototype);


// ChannelWatcher watches for changes in the state on a java.nio Channel.
// It triggers when the reactor's selector detects changes in the channel's
// state. ChannelWatcher does not inherit from Watcher, but provides a
// similar interface.
function ChannelWatcher(reactor, channel, callbacks) {
    this.active = false;
    this.channel = channel;
    this.callbacks = callbacks;
    this.flags = ChannelWatcher.getFlagsForWatcher(this);
    this.pendingFlags = 0;
    this.reactor = reactor;
};
exports.ChannelWatcher = ChannelWatcher;

ChannelWatcher.flagsByKey = {
    // note: OP_CONNECT isn't listed here because it can cause messed up
    // selects on accepted() sockets... use writable instead.
    'acceptable':  java.nio.channels.SelectionKey.OP_ACCEPT,
    'readable':    java.nio.channels.SelectionKey.OP_READ,
    'writable':    java.nio.channels.SelectionKey.OP_WRITE
};

// Returns the SelectionKey bitmask for the callbacks registered
// on the passed channel watcher.
ChannelWatcher.getFlagsForWatcher = function(watcher) {
    var flags = 0;
    var validFlags = watcher.channel.validOps();
    var keys = Object.keys(watcher.callbacks);
    for (var i = 0, len = keys.length; i < len; ++i) {
        var flag = ChannelWatcher.flagsByKey[keys[i]] || 0;
        if (validFlags & flag) {
            flags |= flag;
        }
    }
    return flags;
};

// channelWatcher.callback('readable', function() { ... });
// channelWatcher.callback('readable', undefined);
// Sets the callback for the given key. This will replace any existing
// callbacks for that key. Pass undefined to remove the current callback.
ChannelWatcher.prototype.callback = function(key, newCallback) {
    delete this.callbacks[key];
    if (newCallback) {
        this.callbacks[key] = newCallback;
    }
    this.flags = ChannelWatcher.getFlagsForWatcher(this);
    if (this.key && this.key.isValid()) {
        this.key.interestOps(this.flags);
    }
};

// channelWatcher.invoke();
// Calls all callbacks for pending events.
ChannelWatcher.prototype.invoke = function() {
    if (!this.pendingFlags) {
        return;
    }
    var keys = Object.keys(this.callbacks);
    for (var i = 0, len = keys.length; i < len; ++i) {
        var key = keys[i];
        var flag = ChannelWatcher.flagsByKey[key];
        if (this.pendingFlags & flag) {
            try {
                if (this.callbacks[key]) {  // Might have been removed
                    this.callbacks[key](this);
                }
            } finally {
                this.pendingFlags &= ~flag;
            }
        }
    }
};

// if (channelWatcher.pending()) ...
// Returns true if this watcher has any callbacks for the given flags.
ChannelWatcher.prototype.pending = function() {
    this.pendingFlags |= this.flags & this.key.readyOps();
    return this.pendingFlags ? true : false;
};

// channelWatcher.start();
// Adds the channel to the reactor's watchers and selector.
ChannelWatcher.prototype.start = function() {
    if (!this.active) {
        this.key = this.channel.register(this.reactor.selector, this.flags);
        this.key.attach(this);
        this.active = true;
        this.reactor.addWatcher(this);
    }
    return this;
};

// channelWatcher.stop();
// Removes the channel from the reactor's watchers and selector.
ChannelWatcher.prototype.stop = function() {
    if (this.active) {
        if (this.key && this.key.isValid()) {
            this.key.cancel();
            this.key = null;
        }
        this.active = false;
        this.reactor.removeWatcher(this);
    }
    return this;
};
