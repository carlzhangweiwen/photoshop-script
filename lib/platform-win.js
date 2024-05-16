'use strict';

const fs = 		require('fs'),
      child = require('child_process'),
      path =  require('path'),
      uuid =  require('uuid'),
      os =    require('os');

const exec =      child.exec,
      execSync =  child.execSync;

/******************************************************************************/
// HELPERS
/******************************************************************************/

function find_program(program_dir) {

  const files_in_program_dir = fs.readdirSync(program_dir);

  for (let i = 0; i < files_in_program_dir.length; i++) {
    const file = files_in_program_dir[i];
    if (file.includes('Adobe Photoshop'))
      return path.join(program_dir, file);
  }

  return null;
}

function create_jsx_script(command, sync) {
  const jsx_script_file = path.join(os.tmpdir(),`ps-command-${uuid.v4()}.jsx`);
  const jsx_script = command.toString();
  // const program_path = command.options.program
  //   ? path.join(command.options.program, 'Support Files')
  //   : path.join(program, 'Support Files');
  const program = find_program('C:/Program Files/Adobe');
  const program_path = command.options.program || program;

  if (sync) {
    try {
      fs.writeFileSync(jsx_script_file, jsx_script, 'utf-8');
    } catch (err) {
      throw Error('Could not create jsx script for execution. Check permissions.');
    }
    return {script: jsx_script_file, program_path};
  }
  //async
  return new Promise((resolve, reject)=> {
    fs.writeFile(jsx_script_file, jsx_script, 'utf-8', err => {
      if (err)
        return reject(err);
      resolve({script: jsx_script_file, program_path});
    });
  });
}

/******************************************************************************/
// SETUP
/******************************************************************************/

// const program = find_program('C:/Program Files/Adobe');

/******************************************************************************/
// EXPORT
/******************************************************************************/

module.exports = {

  execute : function(command) {

    return create_jsx_script(command)
    //Execute JSX Script
    .then( jsx => new Promise( resolve => {
        const callback = () => setTimeout(() => {
          fs.unlink(jsx.script, function (err) {
            if (err) console.error(err);
          });
          resolve();
        }, 1000);
        const watcher = fs.watch(os.tmpdir(), (type, filename) => {
          if (filename === command.result_file) {
            // childExec.kill('SIGINT');
            watcher.close();
            callback();
          }
        });
        exec(`Photoshop.exe -r ${ jsx.script }`, { cwd: jsx.program_path });
    }));
  },

  executeSync : function(command) {

    const jsx = create_jsx_script(command, true);
    //Execute JSX
    try {
      execSync(`Photoshop.exe -r ${jsx.script}`, {cwd: jsx.program_path});
    } catch (err) {
      // TODO *
      // I don't know why, executing a child process always throws an error in
      // windows, despite the Photoshop execution working perfectly.
      // For now, we just ignore errors on execSync
    }
    // keep main process wait for a while,
    // otherwise jsx scripts has not been executed
    // and result file won't be generated
    try {
      execSync('wmic csproduct get UUID'); // any cmd can work
    } catch (err) {
      // ignore err here
    }
    setTimeout(() => {
      fs.unlink(jsx.script, function (err) {
        if (err) console.error(err);
      });
    }, 500);
  },

  canExecute: function(command) {
    const program = find_program('C:/Program Files/Adobe');
    return program || command && command.options.program;
  },

  scriptsDir: function(command){
    if (!this.canExecute(command))
      throw new Error('Can\'t get Scripts directory, Photoshop can\'t be found.');

    if (!command || !command.options.program) {
      const program = find_program('C:/Program Files/Adobe');
      return path.join(program, 'Support Files', 'Scripts');
    }
    else
      return path.join(command.options.program, 'Support Files', 'Scripts');
  }
};
