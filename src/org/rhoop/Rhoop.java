package org.rhoop;

import java.io.InputStream;
import java.io.IOException;
import java.net.URL;
import java.net.URLConnection;
import java.util.Map;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Function;
import org.mozilla.javascript.Scriptable;

public class Rhoop {
    public Context context;
    public Scriptable scope;
    public Scriptable argv;
    public Scriptable env;
    public Function require;
    
    public Rhoop(Context context, Scriptable scope, String[] args)
        throws IOException {
        this.context = context;
        this.scope = scope;
        scope.put("rhoop", scope, context.javaToJS(this, scope));
        
        argv = context.newArray(scope, args.length);
        for (int i = 0; i < args.length; ++i) {
            argv.put(i, argv, context.javaToJS(args[i], scope));
        }
        
        env = context.newObject(scope);
        Map<String,String> envMap = System.getenv();
        for (String key: envMap.keySet()) {
            env.put(key, env, context.javaToJS(envMap.get(key), scope));
        }
                    
        require = (Function)compile(Rhoop.class.getResource("/require.js"));
        
        if (args.length > 0) {
            String filename = args[0];
            if (filename.endsWith(".js")) {
                filename = filename.substring(0, filename.length() - 3);
            }
            Object[] requireArgs = {filename};
            require.call(context, scope, scope, requireArgs);
        }
    }
    
    public Object compile(URL url) throws IOException {
        URLConnection connection = url.openConnection();
        InputStream stream = connection.getInputStream();
        return compile(readStreamToString(stream), url.toString());
    }
    
    public Object compile(String code, String filename) {
        return context.evaluateString(scope, code, filename, 1, null);
    }
    
    public String readStreamToString(InputStream stream) throws IOException {
        int bytesRead;
        byte[] bytes = new byte[4096];
        StringBuffer buffer = new StringBuffer();
        while ((bytesRead = stream.read(bytes)) >= 0) {
            buffer.append(new String(bytes, 0, bytesRead));
        }
        return buffer.toString();
    }
    
    public static Rhoop load(Context context, Scriptable scope, String[] args)
        throws IOException {
        return new Rhoop(context, scope, args);
    }
    
    public static void main(String[] args) throws IOException {
        try {
            Context context = Context.enter();
            Scriptable scope = context.initStandardObjects();
            load(context, scope, args);
        } finally {
            Context.exit();
        }
    }
}
