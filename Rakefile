require 'rubygems'
require 'rake/clean'

JAVA_CLASSPATH = ['bin/js.jar', 'src']

# Package a folder into a jar
def jar(src_folder, src_manifest, target_jar)
    sh "jar cvfm #{target_jar} #{src_manifest} -C #{src_folder} ."
end

# Run java 
def java(args)
    classpath = JAVA_CLASSPATH.join(File::PATH_SEPARATOR)
    sh "rlwrap java -Dfile.encoding=UTF8 -cp #{classpath} #{args}"
end

# Compile a java file
def javac(src, opts)
    classpath = JAVA_CLASSPATH.join(File::PATH_SEPARATOR)
    cmd = ["javac"]
    cmd << "-cp #{classpath}"
    cmd << "-d #{opts[:target_dir]}" if opts[:target_dir]
    cmd << src
    sh cmd.join(' ')
end

# Add tasks to compile all the .java files
directory 'build/'

FileList['src/org/**/*.java'].each do |java_file|
    class_file = java_file.pathmap('%{^src,build/}X.class')
    file class_file => ['build/', java_file] do
        javac java_file, :target_dir => 'build/'
    end
    task :build => class_file
end

# Add copy tasks for all the JS files
FileList['src/**/*.js', 'lib/**/*.js'].each do |src_file|
    dst_file = src_file.pathmap('%{^lib|src,build}p')
    dst_dir = dst_file.pathmap('%d/')
    directory dst_dir
    file dst_file => [dst_dir, src_file] do
        cp src_file, dst_file
    end
    task :build => dst_file
end

CLEAN << 'build/'

task :default => :jar

desc "Build java classes."
task :build

desc "Build rhoop.jar containing all the classes and JS files"
file "bin/rhoop.jar" => :build do
    jar "build", "src/manifest.txt", "bin/rhoop.jar"
end
task :jar => "bin/rhoop.jar"

desc "Start a Rhino shell."
task :shell => :build do
    java "org.mozilla.javascript.tools.shell.Main"
end
