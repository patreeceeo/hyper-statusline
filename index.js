const { shell } = require('electron');
const { exec } = require('child_process');
const color = require('color');
const afterAll = require('after-all-results');
const tildify = require('tildify');
const fs = require('fs');

exports.decorateConfig = (config) => {
    console.log('running decorateConfig');
    const colorForeground = color(config.foregroundColor || '#fff');
    const colorBackground = color(config.backgroundColor || '#000');
    const colors = {
        foreground: colorForeground.string(),
        background: colorBackground.string()
    };

    const configColors = Object.assign({
        black: '#000000',
        red: '#ff0000',
        green: '#33ff00',
        yellow: '#ffff00',
        blue: '#0066ff',
        magenta: '#cc00ff',
        cyan: '#00ffff',
        white: '#d0d0d0',
        lightBlack: '#808080',
        lightRed: '#ff0000',
        lightGreen: '#33ff00',
        lightYellow: '#ffff00',
        lightBlue: '#0066ff',
        lightMagenta: '#cc00ff',
        lightCyan: '#00ffff',
        lightWhite: '#ffffff'
    }, config.colors);

    const hyperStatusLine = Object.assign({
        footerTransparent: true,
        mergingColor: configColors.red,
        untrackedColor: configColors.lightRed,
        dirtyColor: configColors.lightYellow,
        stagedColor: configColors.lightGreen,
        aheadColor: configColors.lightBlue,
        behindColor: configColors.lightMagenta,
    }, config.hyperStatusLine);

    return Object.assign({}, config, {
        css: `
            ${config.css || ''}
            .terms_terms {
                margin-bottom: 30px;
            }
            .footer_footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 100;
                font-size: ${config.fontSize}px;
                font-family: ${config.fontFamily};
                height: 30px;
                background-color: ${colors.background};
                opacity: ${hyperStatusLine.footerTransparent ? '0.5' : '1'};
                cursor: default;
                -webkit-user-select: none;
                transition: opacity 250ms ease;
            }
            .footer_footer:hover {
                opacity: 1;
            }
            .footer_footer .footer_group {
                display: flex;
                color: ${colors.foreground};
                white-space: nowrap;
                margin: 0 14px;
            }
            .footer_footer .group_overflow {
                overflow: hidden;
            }
            .footer_footer .component_component {
                display: flex;
            }
            .footer_footer .component_item {
                position: relative;
                line-height: 30px;
                margin-left: 9px;
            }
            .footer_footer .component_item:first-of-type {
                margin-left: 0;
            }
            .footer_footer .item_clickable:hover {
                text-decoration: underline;
                cursor: pointer;
            }
            .footer_footer .item_icon {
                padding-left: 0.5em;
            }
            .footer_footer .item_icon:before {
                background-color: ${colors.background};
                color: ${colors.foreground};
                padding-right: 0.5em;
            }
            .footer_footer .item_number {
                font-weight: 500;
            }
            .footer_footer .item_cwd:before {
                content: '\uf07c';
            }
            .footer_footer .item_branch:before {
                content: '\ue725';
            }
            .footer_footer .item_branch.item_branch__merging:before {
                content: '\uf071\ue727';
                color: ${hyperStatusLine.mergingColor};
            }
            .footer_footer .item_untracked {
                color: ${hyperStatusLine.untrackedColor};
            }
            .footer_footer .item_untracked:before {
                content: '\uf2ac';
                color: ${hyperStatusLine.untrackedColor};
            }
            .footer_footer .item_dirty {
                color: ${hyperStatusLine.dirtyColor};
            }
            .footer_footer .item_dirty:before {
                content: '\uf6f6';
                color: ${hyperStatusLine.dirtyColor};
            }
            .footer_footer .item_staged {
                color: ${hyperStatusLine.stagedColor};
            }
            .footer_footer .item_staged:before {
                content: '\uf21a';
                color: ${hyperStatusLine.stagedColor};
            }
            .footer_footer .item_ahead {
                color: ${hyperStatusLine.aheadColor};
            }
            .footer_footer .item_ahead:before {
                content: '\uf062';
                color: ${hyperStatusLine.aheadColor};
            }
            .footer_footer .item_behind {
                color: ${hyperStatusLine.behindColor};
            }
            .footer_footer .item_icon.item_behind:before {
                content: '\uf063';
                color: ${hyperStatusLine.behindColor};
            }
            .notifications_view {
                bottom: 50px;
            }
        `
    });
};

let pid;
let cwd;
let git = {
    branch: '',
    remote: '',
    merging: false,
    untracked: 0,
    dirty: 0,
    staged: 0,
    ahead: 0,
    behind: 0
}

const setCwd = (pid, action) => {
    if (process.platform == 'win32') {
        let directoryRegex = /([a-zA-Z]:[^\:\[\]\?\"\<\>\|]+)/mi;
        if (action && action.data) {
            let path = directoryRegex.exec(action.data);
            if(path){
                cwd = path[0];
                setGit(cwd);
            }
        }
    } else {
        exec(`lsof -p ${pid} | awk '$4=="cwd"' | tr -s ' ' | cut -d ' ' -f9-`, (err, stdout) => {
            cwd = stdout.trim();
            setGit(cwd);
        });
    }
};

const isGit = (dir, cb) => {
    exec(`git rev-parse --is-inside-work-tree`, { cwd: dir }, (err) => {
        cb(!err);
    });
}

const gitBranch = (repo, cb) => {
    exec(`git symbolic-ref --short HEAD || git rev-parse --short HEAD`, { cwd: repo }, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, stdout.trim());
    });
}

const gitRemote = (repo, cb) => {
    exec(`git ls-remote --get-url`, { cwd: repo }, (err, stdout) => {
        cb(null, stdout.trim().replace(/^git@(.*?):/, 'https://$1/').replace(/[A-z0-9\-]+@/, '').replace(/\.git$/, ''));
    });
}

const gitMerging = (repo, cb) => {
    fs.exists(`${repo}/.git/MERGE_HEAD`, (exists) => {
        cb(null, exists);
    });
}

const gitUntracked = (repo, cb) => {
    exec(`git ls-files --other --exclude-standard`, { cwd: repo }, (err, stdout) => {
        if (err) {
            return cb(err);
        }
        cb(null, !stdout ? 0 : stdout.trim().split('\n').length);
    });
}

const gitDirty = (repo, cb) => {
    exec(`git status --porcelain --ignore-submodules -uno`, { cwd: repo }, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, !stdout ? 0 : stdout.trim().split('\n').length);
    });
}

const gitStaged = (repo, cb) => {
    exec(`git diff --cached --stat=1,1,0`, { cwd: repo }, (err, stdout) => {
        if (err) {
            return cb(err);
        }

        cb(null, !stdout ? 0 : stdout.trim().split('\n').length - 1);
    });
}

const gitAhead = (repo, cb) => {
    exec(`git rev-list --left-only --count HEAD...@'{u}' 2>/dev/null`, { cwd: repo }, (err, stdout) => {
        cb(null, parseInt(stdout, 10));
    });
}

const gitBehind = (repo, cb) => {
    exec(`git rev-list --left-only --count @'{u}'...HEAD 2>/dev/null`, { cwd: repo }, (err, stdout) => {
        cb(null, parseInt(stdout, 10));
    });
}

const gitCheck = (repo, cb) => {
    const next = afterAll((err, results) => {
        if (err) {
            return cb(err);
        }

        const branch = results[0];
        const remote = results[1];
        const merging = results[2];
        const untracked = results[3];
        const dirty = results[4];
        const staged = results[5];
        const ahead = results[6];
        const behind = results[7];

        cb(null, {
            branch: branch,
            remote: remote,
            merging: merging,
            untracked: untracked,
            dirty: dirty,
            staged: staged,
            ahead: ahead,
            behind: behind
        });
    });

    gitBranch(repo, next());
    gitRemote(repo, next());
    gitMerging(repo, next());
    gitUntracked(repo, next());
    gitDirty(repo, next());
    gitStaged(repo, next());
    gitAhead(repo, next());
    gitBehind(repo, next());
}

const setGit = (repo) => {
    isGit(repo, (exists) => {
        if (!exists) {
            git = {
                branch: '',
                remote: '',
                merging: false,
                untracked: 0,
                dirty: 0,
                staged: 0,
                ahead: 0,
                behind: 0
            }

            return;
        }

        gitCheck(repo, (err, result) => {
            if (err) {
                throw err;
            }

            git = {
                branch: result.branch,
                remote: result.remote,
                merging: result.merging,
                untracked: result.untracked,
                dirty: result.dirty,
                staged: result.staged,
                ahead: result.ahead,
                behind: result.behind
            }
        })
    });
}

exports.decorateHyper = (Hyper, { React }) => {
    return class extends React.PureComponent {
        constructor(props) {
            super(props);

            this.state = {
                cwd: '',
                branch: '',
                remote: '',
                merging: false,
                untracked: 0,
                dirty: 0,
                staged: 0,
                ahead: 0,
                behind: 0
            }

            this.handleCwdClick = this.handleCwdClick.bind(this);
            this.handleBranchClick = this.handleBranchClick.bind(this);
        }

        handleCwdClick(event) {
            shell.openExternal('file://'+this.state.cwd);
        }

        handleBranchClick(event) {
            shell.openExternal(this.state.remote);
        }

        render() {
            const { customChildren } = this.props
            const existingChildren = customChildren ? customChildren instanceof Array ? customChildren : [customChildren] : [];

            return (
                React.createElement(Hyper, Object.assign({}, this.props, {
                    customInnerChildren: existingChildren.concat(React.createElement('footer', { className: 'footer_footer' },
                        React.createElement('div', { className: 'footer_group group_overflow' },
                            React.createElement('div', { className: 'component_component component_cwd' },
                                React.createElement('div', { className: 'component_item item_icon item_cwd item_clickable', title: this.state.cwd, onClick: this.handleCwdClick, hidden: !this.state.cwd }, this.state.cwd ? tildify(String(this.state.cwd)) : '')
                            )
                        ),
                        React.createElement('div', { className: 'footer_group' },
                            React.createElement('div', { className: 'component_component component_git' },
                                React.createElement('div', { className: `component_item item_icon item_branch ${this.state.remote ? 'item_clickable' : ''} ${this.state.merging ? 'item_branch__merging' : ''}`, title: `Git branch ${this.state.branch}${this.state.remote ? ` cloned from ${this.state.remote}` : ''}${this.state.merging ? ', merge in progress' : ''}`, onClick: this.handleBranchClick, hidden: !this.state.branch }, this.state.branch),
                                React.createElement('div', { className: 'component_item item_icon item_number item_untracked', title: `${this.state.untracked} untracked ${this.state.untracked > 1 ? 'files' : 'file'}`, hidden: !this.state.untracked }, this.state.untracked),
                                React.createElement('div', { className: 'component_item item_icon item_number item_dirty', title: `${this.state.dirty} dirty ${this.state.dirty > 1 ? 'files' : 'file'}`, hidden: !this.state.dirty }, this.state.dirty),
                                React.createElement('div', { className: 'component_item item_icon item_number item_staged', title: `${this.state.staged} staged ${this.state.staged > 1 ? 'files' : 'file'}`, hidden: !this.state.staged }, this.state.staged),
                                React.createElement('div', { className: 'component_item item_icon item_number item_ahead', title: `${this.state.ahead} ${this.state.ahead > 1 ? 'commits' : 'commit'} ahead`, hidden: !this.state.ahead }, this.state.ahead),
                                React.createElement('div', { className: 'component_item item_icon item_number item_behind', title: `${this.state.behind} ${this.state.behind > 1 ? 'commits' : 'commit'} behind`, hidden: !this.state.behind }, this.state.behind)
                            )
                        )
                    ))
                }))
            );
        }

        componentDidMount() {
            this.interval = setInterval(() => {
                this.setState({
                    cwd: cwd,
                    branch: git.branch,
                    remote: git.remote,
                    merging: git.merging,
                    untracked: git.untracked,
                    dirty: git.dirty,
                    staged: git.staged,
                    ahead: git.ahead,
                    behind: git.behind
                });
            }, 100);
        }

        componentWillUnmount() {
            clearInterval(this.interval);
        }
    };
};

exports.middleware = (store) => (next) => (action) => {
    const uids = store.getState().sessions.sessions;

    switch (action.type) {
        case 'SESSION_SET_XTERM_TITLE':
            pid = uids[action.uid].pid;
            break;

        case 'SESSION_ADD':
            pid = action.pid;
            setCwd(pid);
            break;

        case 'SESSION_ADD_DATA':
            const { data } = action;
            const enterKey = data.indexOf('\n') > 0;

            if (enterKey) {
                setCwd(pid, action);
            }
            break;

        case 'SESSION_SET_ACTIVE':
            pid = uids[action.uid].pid;
            setCwd(pid);
            break;
    }

    next(action);
};
// vim: ts=4 sts=4 sw=4
