// FIXME: things to think about: pause/resume the event loop; linked lists or
// binary trees for keeping timers sorted; account for time jumps

var watchers = require('watchers');

var Reactor = exports.Reactor = function() {
    this.watchers = {
        beforeTick: [],
        nextTick:   [],
        channel:    [],
        scheduled:  [],
        delayed:    [],
        idle:       [],
        afterTick:  []
    };
    this.pending = [];
    this.running = false;
    this.selector = java.nio.channels.Selector.open(); 
    this.sleep = true;
    this.tick = 0;
    this.tickInterval = 0.01;
    this.updateTime();
};

// reactor.afterTick(function(watcher) {
//     print("run after every event loop iteration");
// });
Reactor.prototype.afterTick = function(callback) {
    var watcher = new watchers.Watcher(this, callback);
    watcher.group = 'afterTick';
    watcher.start();
    return watcher;
};

// reactor.beforeTick(function(watcher) {
//     print("run before every event loop iteration");
// });
Reactor.prototype.beforeTick = function(callback) {
    var watcher = new watchers.Watcher(this, callback);
    watcher.group = 'beforeTick';
    watcher.start();
    return watcher;
};

// reactor.nextTick(function(watcher) {
//     print("one time callback, run at the start of the next loop");
// });
Reactor.prototype.nextTick = function(callback) {
    var watcher = new watchers.Watcher(this, callback);
    watcher.group = 'nextTick';
    watcher.start();
    return watcher;
};

// Creates a watcher to monitor a java.nio.channels.Channel stream.
//
// var watcher = reactor.channelCallback(channel, {
//    readable: function(watcher) {
//        print("channel is now readable");
//    },
//    
//    writable: function(watcher) {
//        print("channel is now writable");
//    }
// });
Reactor.prototype.channelCallbacks = function(channel, callbacks) {
    return new watchers.ChannelWatcher(this, channel, callbacks).start();
};

// Creates a watcher which will be called when there is nothing else
// to do during an iteration of the event loop.
//
// var watcher = reactor.idleCallback(function() {
//     print('reactor is idle');
// });
Reactor.prototype.idleCallback = function(callback) {
    var watcher = new watchers.Watcher(this, callback);
    watcher.group = 'idle';
    watcher.start();
    return watcher;
};

// Create a relative timer callback. (e.g. setTimeout).
//
// var watcher = reactor.delayCallback(5, function() {
//     print('five seconds have passed');
// });
Reactor.prototype.delayCallback = function(delay, callback) {
    return new watchers.DelayedWatcher(this, delay, callback).start();
};

// Create an absolute timer, to be invoked at a specific datetime.
//
// var time = new Date(2012, 01, 01).getTime() / 1000;  // seconds
// var watcher = reactor.scheduleCallback(time, function() {
//     print('ohhhh nnoooooooooo!');
// });
Reactor.prototype.scheduleCallback = function(time, callback) {
    return new watchers.ScheduledWatcher(this, time, callback).start();
};

Reactor.prototype.addWatcher = function(watcher) {
    var group = this.groupForWatcher(watcher);
    this.watchers[group].push(watcher);
    return watcher;
};

Reactor.prototype.hasWatchers = function(key) {
    if (key) {
        return this.watchers[key].length > 0;
    } else {
        var keys = Object.keys(this.watchers);
        var i = keys.length;
        while (i--) {
            if (this.watchers[keys[i]].length > 0) {
                return true;
            }
        }
        return false;
    }
};

Reactor.prototype.groupForWatcher = function(watcher) {
    // FIXME: this is annoying... watchers should specify this themselves.
    if (watcher instanceof watchers.ChannelWatcher) {
        return 'channel';
    } else if (watcher instanceof watchers.ScheduledWatcher) {
        return 'scheduled';
    } else if (watcher instanceof watchers.DelayedWatcher) {
        return 'delayed';
    } else if (watcher instanceof watchers.Watcher) {
        return watcher.group;
    } else {
        throw new TypeError('invalid watcher ' + watcher);
    }
};

Reactor.prototype.removeWatcher = function(watcher) {
    var watchers = this.watchers[this.groupForWatcher(watcher)];
    var index = watchers.indexOf(watcher);
    if (index !== -1) {
        watchers.splice(index, 1);
    }
};

Reactor.prototype.invokePending = function(key) {
    for (var i = 0, len = this.pending.length; i < len; ++i) {
        this.pending[i].invoke();
    }
    this.pending.length = 0;
};

Reactor.prototype.queuePending = function(watchers, lockOut) {
    if (lockOut && this.pending.length > 0) {
        return;
    }
    for (var i = 0, len = watchers.length; i < len; ++i) {
        if (watchers[i].pending()) {
            this.pending.push(watchers[i]);
        }
    }
};

Reactor.prototype.queueSelected = function() {
    var selected = this.selector.selectedKeys();
    var iterator = selected.iterator();
    while (iterator.hasNext()) {
        var key = iterator.next();
        var watcher = key.attachment();
        iterator.remove();
        if (watcher.pending()) {
            this.pending.push(watcher);
        }
    }
    selected.clear();
};

// Starts the event loop. This function will block until reactor.stop() is
// called or there are no remaining watchers on the reactor.
Reactor.prototype.run = function() {
    if (this.running) {
        throw new Error('run() called but looping already true (recursion?)');
    }
    this.running = true;
    do {
        this.updateTime();
        this.queuePending(this.watchers.beforeTick);
        this.queuePending(this.watchers.nextTick);
        this.watchers.nextTick.length = 0;  // FIXME: kill watchers too?
        this.invokePending();
        if (!this.running) {
            break;
        }
        if (this.selector.selectNow() > 0) {
            this.queueSelected();
        }
        if (!this.pending.length && this.sleep && this.tickInterval > 0) {
            // FIXME: if timer is scheduled in less time, sleep for less
            java.lang.Thread.sleep(this.tickInterval * 1000);
        }
        this.queuePending(this.watchers.scheduled);
        this.queuePending(this.watchers.delayed);
        this.queuePending(this.watchers.idle, true);
        this.queuePending(this.watchers.afterTick);
        this.invokePending();
        this.tick++;
    } while (this.running && this.hasWatchers());
};

// Stop the main event loop. The current iteration will complete first.
Reactor.prototype.stop = function() {
    this.running = false;
};

Reactor.prototype.updateTime = function() {
    this.time = java.lang.System.currentTimeMillis() / 1000;
};
