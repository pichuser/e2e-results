#!/usr/bin/env node
const xml2js = require('xml2js');
const fs = require('fs');
const got = require('got');
const { NodeSSH } = require('node-ssh');
const argv = require('yargs/yargs')(process.argv.slice(2))
    .example('$0 -p xmlresults.xml -r google.com -s slack/path')
    .nargs('p', 1).alias('p', 'path').describe('p', 'Путь к xmlresults.xml')
    .nargs('l', 1).alias('l', 'link').describe('l', 'Ссылка на отчёт')
    .nargs('s', 1).alias('s', 'slack').describe('s', 'Ссылка на слак')
    .nargs('ssh', 1).describe('ssh', 'Ссылка login_pass_server')
    .demandOption(['p', 'l', 's', 'ssh'])
    .help('h')
    .argv;

xml2js.parseStringPromise(fs.readFileSync(argv.path)).then(result => {
    const {disabled, errors, failures, tests, time} = result.testsuites.$;
    const data = {
        text: `*Ссылка на отчет:*: ${argv.link}
*Всего тестов:*: ${tests}
*Успешно:*: ${tests - failures}
*Ошибок:*: ${failures}
*Время выполнения*: ${time}
        `
    }
    return got.post(argv.slack, {
        json: data,
    });
}).then(console.log('success slack'));

load().then(console.log('success upload'));
async function load() {
    const ssh = new NodeSSH()
    const [login, pass, server] = argv.ssh.split('_');
    await ssh.connect({
        host: server,
        username: login,
        password: pass,
    })
    const com = await ssh.execCommand('rm -rf /reports/4kam_e2e');
    const failed = [];
    const successful = [];
    const status = await ssh.putDirectory('reports', '/reports/4kam_e2e', {
        recursive: true,
        concurrency: 10,
        // ^ WARNING: Not all servers support high concurrency
        // try a bunch of values and see what works on your server
        validate: function(itemPath) {
            return true;
        },
        tick: function(localPath, remotePath, error) {
            if (error) {
                failed.push(localPath)
            } else {
                successful.push(localPath)
            }
        }
    })
    ssh.dispose();
}
