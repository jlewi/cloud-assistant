/**
 * Note: this file is used within Node.js and Browser environment.
 * Only export cross compatible objects here.
 */
export declare enum OutputType {
    vercel = "stateful.runme/vercel-stdout",
    deno = "stateful.runme/deno-stdout",
    outputItems = "stateful.runme/output-items",
    annotations = "stateful.runme/annotations",
    terminal = "stateful.runme/terminal",
    error = "stateful.runme/error",
    github = "stateful.runme/github-stdout",
    stdout = "application/vnd.code.notebook.stdout",
    gcp = "stateful.runme/gcp",
    aws = "stateful.runme/aws",
    daggerCall = "stateful.runme/dagger",
    daggerShell = "stateful.runme/dagger"
}
export declare enum ClientMessages {
    infoMessage = "common:infoMessage",
    errorMessage = "common:errorMessage",
    closeCellOutput = "common:closeCellOutput",
    displayPrompt = "common:displayPrompt",
    onPrompt = "common:onPrompt",
    setState = "common:setState",
    getState = "common:getState",
    onGetState = "common:onGetState",
    onCategoryChange = "common:onCategoryChange",
    platformApiRequest = "common:platformApiRequest",
    platformApiResponse = "common:platformApiResponse",
    optionsMessage = "common:optionsMessage",
    optionsModal = "common:optionsModal",
    openExternalLink = "common:openExternalLink",
    onOptionsMessage = "common:onOptionsMessage",
    copyTextToClipboard = "common:copyTextToClipboard",
    onCopyTextToClipboard = "common:onCopyTextToClipboard",
    onProgramClose = "common:onProgramClose",
    denoUpdate = "deno:deploymentUpdate",
    denoPromote = "deno:promoteDeployment",
    vercelProd = "vercel:promotePreview",
    mutateAnnotations = "annotations:mutate",
    terminalStdout = "terminal:stdout",
    terminalStderr = "terminal:stderr",
    terminalStdin = "terminal:stdin",
    terminalResize = "terminal:resize",
    terminalFocus = "terminal:focus",
    terminalOpen = "terminal:open",
    openLink = "terminal:openLink",
    activeThemeChanged = "theme:changed",
    githubWorkflowDispatch = "github:workflowDispatch",
    githubWorkflowDeploy = "github:workflowDeploy",
    githubWorkflowStatusUpdate = "github:workflowStatusUpdate",
    tangleEvent = "tangle:event",
    gcpResourceStatusChanged = "gcp:resourceStatusChanged",
    gcpClusterCheckStatus = "gcp:clusterCheckStatus",
    gcpClusterDetails = "gcp:clusterDetails",
    gcpClusterDetailsNewCell = "gcp:clusterDetailsNewCell",
    gcpClusterDetailsResponse = "gcp:clusterDetailsResponse",
    gcpVMInstanceAction = "gcp:gceVMInstanceAction",
    awsEC2Instances = "aws:ec2Instances",
    awsEC2InstanceAction = "aws:ec2InstanceAction",
    awsEKSClusterAction = "aws:eksClusterAction",
    onAuthorModeChange = "common:onAuthorModeChange",
    gistCell = "gist:cell",
    gcpCloudRunAction = "gcp:cloudRunAction",
    gcpLoadServices = "gcp:loadServices",
    gcpServicesLoaded = "gcp:servicesLoaded",
    daggerSyncState = "dagger:syncState",
    daggerCliAction = "dagger:cliAction",
    featuresUpdateAction = "features:updateAction",
    featuresRequest = "features:request",
    featuresResponse = "features:response"
}
export declare const LANG_IDS_WITH_DESTINATION: (string | undefined)[][];
export declare const LANGID_AND_EXTENSIONS: Map<string, string>;
export declare const LANGUAGES: Map<string | undefined, string | undefined>;
/**
 * Map from vscode language id to how it should be represented in markdown
 *
 * For example, the vscode language id for all bash-like shells is
 * "shellscript," so this object maps "shellscript" -> "sh"
 */
export declare const VSCODE_LANGUAGEID_MAP: Record<string, string | undefined>;
export declare const DEFAULT_LANGUAGEID = "shellscript";
export declare const SERVER_ADDRESS = "localhost";
export declare const SERVER_PORT = 7863;
export declare const DEFAULT_PROMPT_ENV = true;
export declare enum RENDERERS {
    VercelOutput = "vercel-output",
    DenoOutput = "deno-output",
    ShellOutput = "shell-output",
    ShellOutputItems = "shell-output-items",
    EditAnnotations = "edit-annotations",
    TerminalView = "terminal-view",
    GitHubWorkflowViewer = "github-workflow-viewer",
    GCPView = "gcp-view",
    AWSView = "aws-view",
    DaggerCli = "dagger-cli"
}
export declare enum AuthenticationProviders {
    GitHub = "github",
    Stateful = "stateful"
}
export declare enum NotebookMode {
    Execution = "execution",
    SessionOutputs = "sessionOutputs"
}
export declare const NOTEBOOK_AVAILABLE_CATEGORIES = "notebookAvailableCategories";
export declare const NOTEBOOK_HAS_CATEGORIES = "notebookHasCategories";
export declare const NOTEBOOK_AUTOSAVE_ON = "notebookAutoSaveOn";
export declare const NOTEBOOK_LIFECYCLE_ID = "notebookLifecycleId";
export declare const NOTEBOOK_OUTPUTS_MASKED = "notebookOutputsMasked";
export declare const NOTEBOOK_MODE = "notebookMode";
export declare const NOTEBOOK_PREVIEW_OUTPUTS = "notebookPreviewRunmeOutputs";
export declare const NOTEBOOK_RUN_WITH_PROMPTS = "notebookRunWithPrompts";
export declare const NOTEBOOK_AUTHOR_MODE_ON = "notebookAuthorModeOn";
export declare const NOTEBOOK_ENV_VAR_MODE = "notebookEnvVarMode";
/**
 * https://gist.github.com/ppisarczyk/43962d06686722d26d176fad46879d41?permalink_comment_id=3949999#gistcomment-3949999
 */
export declare const LANGUAGE_PREFIXES: {
    abap: string;
    asc: string;
    ash: string;
    ampl: string;
    mod: string;
    g4: string;
    apib: string;
    apl: string;
    dyalog: string;
    asp: string;
    asax: string;
    ascx: string;
    ashx: string;
    asmx: string;
    aspx: string;
    axd: string;
    dats: string;
    hats: string;
    sats: string;
    as: string;
    adb: string;
    ada: string;
    ads: string;
    agda: string;
    als: string;
    apacheconf: string;
    vhost: string;
    cls: string;
    applescript: string;
    scpt: string;
    arc: string;
    ino: string;
    asciidoc: string;
    adoc: string;
    aj: string;
    asm: string;
    a51: string;
    inc: string;
    nasm: string;
    aug: string;
    ahk: string;
    ahkl: string;
    au3: string;
    awk: string;
    auk: string;
    gawk: string;
    mawk: string;
    nawk: string;
    bat: string;
    cmd: string;
    befunge: string;
    bison: string;
    bb: string;
    decls: string;
    bmx: string;
    bsv: string;
    boo: string;
    b: string;
    bf: string;
    brs: string;
    bro: string;
    c: string;
    cats: string;
    h: string;
    idc: string;
    w: string;
    cs: string;
    cake: string;
    cshtml: string;
    csx: string;
    cpp: string;
    'c++': string;
    cc: string;
    cp: string;
    cxx: string;
    'h++': string;
    hh: string;
    hpp: string;
    hxx: string;
    inl: string;
    ipp: string;
    tcc: string;
    tpp: string;
    'c-objdump': string;
    chs: string;
    clp: string;
    cmake: string;
    'cmake.in': string;
    cob: string;
    cbl: string;
    ccp: string;
    cobol: string;
    cpy: string;
    css: string;
    csv: string;
    capnp: string;
    mss: string;
    ceylon: string;
    chpl: string;
    ch: string;
    ck: string;
    cirru: string;
    clw: string;
    icl: string;
    dcl: string;
    click: string;
    clj: string;
    boot: string;
    cl2: string;
    cljc: string;
    cljs: string;
    'cljs.hl': string;
    cljscm: string;
    cljx: string;
    hic: string;
    coffee: string;
    _coffee: string;
    cjsx: string;
    cson: string;
    iced: string;
    cfm: string;
    cfml: string;
    cfc: string;
    lisp: string;
    asd: string;
    cl: string;
    l: string;
    lsp: string;
    ny: string;
    podsl: string;
    sexp: string;
    cps: string;
    coq: string;
    v: string;
    cppobjdump: string;
    'c++-objdump': string;
    'c++objdump': string;
    'cpp-objdump': string;
    'cxx-objdump': string;
    creole: string;
    cr: string;
    feature: string;
    cu: string;
    cuh: string;
    cy: string;
    pyx: string;
    pxd: string;
    pxi: string;
    d: string;
    di: string;
    'd-objdump': string;
    com: string;
    dm: string;
    zone: string;
    arpa: string;
    darcspatch: string;
    dpatch: string;
    dart: string;
    diff: string;
    patch: string;
    dockerfile: string;
    djs: string;
    dylan: string;
    dyl: string;
    intr: string;
    lid: string;
    E: string;
    ecl: string;
    eclxml: string;
    sch: string;
    brd: string;
    epj: string;
    e: string;
    ex: string;
    exs: string;
    elm: string;
    el: string;
    emacs: string;
    'emacs.desktop': string;
    em: string;
    emberscript: string;
    erl: string;
    es: string;
    escript: string;
    hrl: string;
    xrl: string;
    yrl: string;
    fs: string;
    fsi: string;
    fsx: string;
    fx: string;
    flux: string;
    f90: string;
    f: string;
    f03: string;
    f08: string;
    f77: string;
    f95: string;
    for: string;
    fpp: string;
    factor: string;
    fy: string;
    fancypack: string;
    fan: string;
    'eam.fs': string;
    fth: string;
    '4th': string;
    forth: string;
    fr: string;
    frt: string;
    ftl: string;
    g: string;
    gco: string;
    gcode: string;
    gms: string;
    gap: string;
    gd: string;
    gi: string;
    tst: string;
    s: string;
    ms: string;
    glsl: string;
    fp: string;
    frag: string;
    frg: string;
    fsh: string;
    fshader: string;
    geo: string;
    geom: string;
    glslv: string;
    gshader: string;
    shader: string;
    vert: string;
    vrx: string;
    vsh: string;
    vshader: string;
    gml: string;
    kid: string;
    ebuild: string;
    eclass: string;
    po: string;
    pot: string;
    glf: string;
    gp: string;
    gnu: string;
    gnuplot: string;
    plot: string;
    plt: string;
    go: string;
    golo: string;
    gs: string;
    gst: string;
    gsx: string;
    vark: string;
    grace: string;
    gradle: string;
    gf: string;
    graphql: string;
    dot: string;
    gv: string;
    man: string;
    '1in': string;
    '1m': string;
    '1x': string;
    '3in': string;
    '3m': string;
    '3qt': string;
    '3x': string;
    me: string;
    n: string;
    rno: string;
    roff: string;
    groovy: string;
    grt: string;
    gtpl: string;
    gvy: string;
    gsp: string;
    hcl: string;
    tf: string;
    hlsl: string;
    fxh: string;
    hlsli: string;
    html: string;
    htm: string;
    'html.hl': string;
    st: string;
    xht: string;
    xhtml: string;
    mustache: string;
    jinja: string;
    eex: string;
    erb: string;
    'erb.deface': string;
    phtml: string;
    http: string;
    php: string;
    haml: string;
    'haml.deface': string;
    handlebars: string;
    hbs: string;
    hb: string;
    hs: string;
    hsc: string;
    hx: string;
    hxsl: string;
    hy: string;
    pro: string;
    dlm: string;
    ipf: string;
    ini: string;
    cfg: string;
    prefs: string;
    properties: string;
    irclog: string;
    weechatlog: string;
    idr: string;
    lidr: string;
    ni: string;
    i7x: string;
    iss: string;
    io: string;
    ik: string;
    thy: string;
    ijs: string;
    flex: string;
    jflex: string;
    json: string;
    geojson: string;
    lock: string;
    topojson: string;
    json5: string;
    jsonld: string;
    jq: string;
    jsx: string;
    jade: string;
    j: string;
    java: string;
    jsp: string;
    js: string;
    _js: string;
    bones: string;
    es6: string;
    jake: string;
    jsb: string;
    jscad: string;
    jsfl: string;
    jsm: string;
    jss: string;
    njs: string;
    pac: string;
    sjs: string;
    ssjs: string;
    'sublime-build': string;
    'sublime-commands': string;
    'sublime-completions': string;
    'sublime-keymap': string;
    'sublime-macro': string;
    'sublime-menu': string;
    'sublime-mousemap': string;
    'sublime-project': string;
    'sublime-settings': string;
    'sublime-theme': string;
    'sublime-workspace': string;
    sublime_metrics: string;
    sublime_session: string;
    xsjs: string;
    xsjslib: string;
    jl: string;
    ipynb: string;
    krl: string;
    kicad_pcb: string;
    kit: string;
    kt: string;
    ktm: string;
    kts: string;
    lfe: string;
    ll: string;
    lol: string;
    lsl: string;
    lslp: string;
    lvproj: string;
    lasso: string;
    las: string;
    lasso8: string;
    lasso9: string;
    ldml: string;
    latte: string;
    lean: string;
    hlean: string;
    less: string;
    lex: string;
    ly: string;
    ily: string;
    m: string;
    ld: string;
    lds: string;
    liquid: string;
    lagda: string;
    litcoffee: string;
    lhs: string;
    ls: string;
    _ls: string;
    xm: string;
    x: string;
    xi: string;
    lgt: string;
    logtalk: string;
    lookml: string;
    lua: string;
    fcgi: string;
    nse: string;
    pd_lua: string;
    rbxs: string;
    wlua: string;
    mumps: string;
    m4: string;
    mcr: string;
    mtml: string;
    muf: string;
    mak: string;
    mk: string;
    mkfile: string;
    mako: string;
    mao: string;
    md: string;
    markdown: string;
    mkd: string;
    mkdn: string;
    mkdown: string;
    ron: string;
    mask: string;
    mathematica: string;
    cdf: string;
    ma: string;
    mt: string;
    nb: string;
    nbp: string;
    wl: string;
    wlt: string;
    matlab: string;
    maxpat: string;
    maxhelp: string;
    maxproj: string;
    mxt: string;
    pat: string;
    mediawiki: string;
    wiki: string;
    moo: string;
    metal: string;
    minid: string;
    druby: string;
    duby: string;
    mir: string;
    mirah: string;
    mo: string;
    mms: string;
    mmk: string;
    monkey: string;
    moon: string;
    myt: string;
    ncl: string;
    nl: string;
    nsi: string;
    nsh: string;
    axs: string;
    axi: string;
    'axs.erb': string;
    'axi.erb': string;
    nlogo: string;
    nginxconf: string;
    nim: string;
    nimrod: string;
    ninja: string;
    nit: string;
    nix: string;
    nu: string;
    numpy: string;
    numpyw: string;
    numsc: string;
    ml: string;
    eliom: string;
    eliomi: string;
    ml4: string;
    mli: string;
    mll: string;
    mly: string;
    objdump: string;
    mm: string;
    sj: string;
    omgrofl: string;
    opa: string;
    opal: string;
    opencl: string;
    p: string;
    scad: string;
    org: string;
    ox: string;
    oxh: string;
    oxo: string;
    oxygene: string;
    oz: string;
    pwn: string;
    aw: string;
    ctp: string;
    php3: string;
    php4: string;
    php5: string;
    phps: string;
    phpt: string;
    pls: string;
    pck: string;
    pkb: string;
    pks: string;
    plb: string;
    plsql: string;
    sql: string;
    pov: string;
    pan: string;
    psc: string;
    parrot: string;
    pasm: string;
    pir: string;
    pas: string;
    dfm: string;
    dpr: string;
    lpr: string;
    pp: string;
    pl: string;
    al: string;
    cgi: string;
    perl: string;
    ph: string;
    plx: string;
    pm: string;
    pod: string;
    psgi: string;
    t: string;
    '6pl': string;
    '6pm': string;
    nqp: string;
    p6: string;
    p6l: string;
    p6m: string;
    pl6: string;
    pm6: string;
    pkl: string;
    pig: string;
    pike: string;
    pmod: string;
    pogo: string;
    pony: string;
    ps: string;
    eps: string;
    ps1: string;
    psd1: string;
    psm1: string;
    pde: string;
    prolog: string;
    yap: string;
    spin: string;
    proto: string;
    pub: string;
    pd: string;
    pb: string;
    pbi: string;
    purs: string;
    py: string;
    bzl: string;
    gyp: string;
    lmi: string;
    pyde: string;
    pyp: string;
    pyt: string;
    pyw: string;
    rpy: string;
    tac: string;
    wsgi: string;
    xpy: string;
    pytb: string;
    qml: string;
    qbs: string;
    pri: string;
    r: string;
    rd: string;
    rsx: string;
    raml: string;
    rdoc: string;
    rbbas: string;
    rbfrm: string;
    rbmnu: string;
    rbres: string;
    rbtbar: string;
    rbuistate: string;
    rhtml: string;
    rmd: string;
    rkt: string;
    rktd: string;
    rktl: string;
    scrbl: string;
    rl: string;
    raw: string;
    reb: string;
    r2: string;
    r3: string;
    rebol: string;
    red: string;
    reds: string;
    cw: string;
    rs: string;
    rsh: string;
    robot: string;
    rg: string;
    rb: string;
    builder: string;
    gemspec: string;
    god: string;
    irbrc: string;
    jbuilder: string;
    mspec: string;
    pluginspec: string;
    podspec: string;
    rabl: string;
    rake: string;
    rbuild: string;
    rbw: string;
    rbx: string;
    ru: string;
    ruby: string;
    thor: string;
    watchr: string;
    'rs.in': string;
    sas: string;
    scss: string;
    smt2: string;
    smt: string;
    sparql: string;
    rq: string;
    sqf: string;
    hqf: string;
    cql: string;
    ddl: string;
    prc: string;
    tab: string;
    udf: string;
    viw: string;
    db2: string;
    ston: string;
    svg: string;
    sage: string;
    sagews: string;
    sls: string;
    sass: string;
    scala: string;
    sbt: string;
    sc: string;
    scaml: string;
    scm: string;
    sld: string;
    sps: string;
    ss: string;
    sci: string;
    sce: string;
    self: string;
    sh: string;
    bash: string;
    bats: string;
    command: string;
    ksh: string;
    'sh.in': string;
    tmux: string;
    tool: string;
    zsh: string;
    'sh-session': string;
    shen: string;
    sl: string;
    slim: string;
    smali: string;
    tpl: string;
    sp: string;
    sma: string;
    nut: string;
    stan: string;
    ML: string;
    fun: string;
    sig: string;
    sml: string;
    do: string;
    ado: string;
    doh: string;
    ihlp: string;
    mata: string;
    matah: string;
    sthlp: string;
    styl: string;
    scd: string;
    swift: string;
    sv: string;
    svh: string;
    vh: string;
    toml: string;
    txl: string;
    tcl: string;
    adp: string;
    tm: string;
    tcsh: string;
    csh: string;
    tex: string;
    aux: string;
    bbx: string;
    bib: string;
    cbx: string;
    dtx: string;
    ins: string;
    lbx: string;
    ltx: string;
    mkii: string;
    mkiv: string;
    mkvi: string;
    sty: string;
    toc: string;
    tea: string;
    txt: string;
    no: string;
    textile: string;
    thrift: string;
    tu: string;
    ttl: string;
    twig: string;
    ts: string;
    tsx: string;
    upc: string;
    anim: string;
    asset: string;
    mat: string;
    meta: string;
    prefab: string;
    unity: string;
    uno: string;
    uc: string;
    ur: string;
    urs: string;
    vcl: string;
    vhdl: string;
    vhd: string;
    vhf: string;
    vhi: string;
    vho: string;
    vhs: string;
    vht: string;
    vhw: string;
    vala: string;
    vapi: string;
    veo: string;
    vim: string;
    vb: string;
    bas: string;
    frm: string;
    frx: string;
    vba: string;
    vbhtml: string;
    vbs: string;
    volt: string;
    vue: string;
    owl: string;
    webidl: string;
    x10: string;
    xc: string;
    xml: string;
    ant: string;
    axml: string;
    ccxml: string;
    clixml: string;
    cproject: string;
    csl: string;
    csproj: string;
    ct: string;
    dita: string;
    ditamap: string;
    ditaval: string;
    'dll.config': string;
    dotsettings: string;
    filters: string;
    fsproj: string;
    fxml: string;
    glade: string;
    grxml: string;
    iml: string;
    ivy: string;
    jelly: string;
    jsproj: string;
    kml: string;
    launch: string;
    mdpolicy: string;
    mxml: string;
    nproj: string;
    nuspec: string;
    odd: string;
    osm: string;
    plist: string;
    props: string;
    ps1xml: string;
    psc1: string;
    pt: string;
    rdf: string;
    rss: string;
    scxml: string;
    srdf: string;
    storyboard: string;
    stTheme: string;
    'sublime-snippet': string;
    targets: string;
    tmCommand: string;
    tml: string;
    tmLanguage: string;
    tmPreferences: string;
    tmSnippet: string;
    tmTheme: string;
    ui: string;
    urdf: string;
    ux: string;
    vbproj: string;
    vcxproj: string;
    vssettings: string;
    vxml: string;
    wsdl: string;
    wsf: string;
    wxi: string;
    wxl: string;
    wxs: string;
    x3d: string;
    xacro: string;
    xaml: string;
    xib: string;
    xlf: string;
    xliff: string;
    xmi: string;
    'xml.dist': string;
    xproj: string;
    xsd: string;
    xul: string;
    zcml: string;
    'xsp-config': string;
    'xsp.metadata': string;
    xpl: string;
    xproc: string;
    xquery: string;
    xq: string;
    xql: string;
    xqm: string;
    xqy: string;
    xs: string;
    xslt: string;
    xsl: string;
    xojo_code: string;
    xojo_menu: string;
    xojo_report: string;
    xojo_script: string;
    xojo_toolbar: string;
    xojo_window: string;
    xtend: string;
    yml: string;
    reek: string;
    rviz: string;
    'sublime-syntax': string;
    syntax: string;
    yaml: string;
    'yaml-tmlanguage': string;
    yang: string;
    y: string;
    yacc: string;
    yy: string;
    zep: string;
    zimpl: string;
    zmpl: string;
    zpl: string;
    desktop: string;
    'desktop.in': string;
    ec: string;
    eh: string;
    edn: string;
    fish: string;
    mu: string;
    nc: string;
    ooc: string;
    rst: string;
    rest: string;
    'rest.txt': string;
    'rst.txt': string;
    wisp: string;
    prg: string;
    prw: string;
};
export declare const SUPPORTED_FILE_EXTENSIONS: string[];
export declare const EXTENSION_NAME = "stateful.runme";
export declare enum TELEMETRY_EVENTS {
    RecommendExtension = "runme.recommendExtension",
    NotebookGist = "runme.notebookGist",
    CellGist = "runme.cellGist",
    ShellWarning = "extension.shellWarning",
    OpenWorkspace = "cloud.OpenWorkspace"
}
export declare enum WebViews {
    RunmeCloud = "runme.cloud",
    RunmeChat = "runme.chat",
    RunmeSearch = "runme.search",
    NotebookEnvStore = "runme.notebook.envStore"
}
export declare const CATEGORY_SEPARATOR = ",";
export declare const FOCUS_CELL_STORAGE_KEY = "focusCell";
export declare const EXECUTION_CELL_STORAGE_KEY = "executionCell";
export declare const CELL_CREATION_DATE_STORAGE_KEY = "cellCreationDate";
export declare const SAVE_CELL_LOGIN_CONSENT_STORAGE_KEY = "loginConsent";
export declare const GITHUB_USER_SIGNED_IN = "userSignedIn";
export declare const PLATFORM_USER_SIGNED_IN = "platformUserSignedIn";
export declare const RUNME_FRONTMATTER_PARSED = "runme.dev/frontmatterParsed";
