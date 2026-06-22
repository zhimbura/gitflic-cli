// gitflic completion — emit shell completion scripts for bash/zsh/fish.
//
// Usage:
//   eval "$(gitflic completion bash)"
//   gitflic completion zsh > "${fpath[1]}/_gitflic"
//   gitflic completion fish | source

const TOP_COMMANDS = [
  "auth", "mr", "branch", "tag", "release", "issue", "commit", "blob",
  "settings", "user", "project", "team", "company", "environment", "webhook",
  "registry", "cicd", "runner", "admin", "saml", "cache",
];

const GLOBAL_FLAGS = [
  "--project", "--api-base", "--token", "--format", "--page", "--size", "--all",
  "--color", "--no-color", "--help",
];

// ---------- bash ----------

const BASH = `# bash completion for gitflic
# Add to ~/.bashrc:
#   eval "$(gitflic completion bash)"

_gitflic_top() {
  local cmds="${TOP_COMMANDS.join(" ")}"
  COMPREPLY=( \$(compgen -W "\${cmds}" -- "\${COMP_WORDS[1]}") )
}

_gitflic_global_flags() {
  local flags="${GLOBAL_FLAGS.join(" ")}"
  COMPREPLY=( \$(compgen -W "\${flags}" -- "\${COMP_WORDS[COMP_CWORD]}") )
}

_gitflic() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # If current word starts with -, complete flag
  if [[ "\${cur}" == -* ]]; then
    _gitflic_global_flags
    return 0
  fi

  # First positional = top-level command
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    _gitflic_top
    return 0
  fi

  # Otherwise: try sub-commands (left as a hint — full sub-completion
  # would require a 'gitflic <cmd> --list-subcommands' introspection.
  # For now, fall back to global flags.)
  _gitflic_global_flags
  return 0
}

complete -F _gitflic gitflic
`;

// ---------- zsh ----------

const ZSH = `#compdef gitflic
# zsh completion for gitflic
# Install:
#   gitflic completion zsh > "\${fpath[1]}/_gitflic"
#   autoload -U compinit && compinit

_gitflic() {
  local -a top_cmds
  top_cmds=(
    ${TOP_COMMANDS.map((c) => `'${c}'`).join("\n    ")}
  )

  local -a global_flags
  global_flags=(
    ${GLOBAL_FLAGS.map((f) => `'${f}'`).join("\n    ")}
  )

  _arguments -C \\
    '1: :->cmd' \\
    '*::arg:->args'

  case \$state in
    cmd)
      _describe 'command' top_cmds
      ;;
    args)
      _describe 'flag' global_flags
      ;;
  esac
}

_gitflic "\$@"
`;

// ---------- fish ----------

const FISH = `# fish completion for gitflic
# Install:
#   gitflic completion fish > ~/.config/fish/completions/gitflic.fish

set -l top_cmds \\
  ${TOP_COMMANDS.join(" ")}
set -l global_flags \\
  ${GLOBAL_FLAGS.join(" ")}

function __gitflic_complete
  set -l cmd (commandline -opc)
  set -l cur (commandline -ct)
  set -l cword (count $cmd)

  # First word = program, second = top command
  if test $cword -eq 2
    if string match -q -- '-*' $cur
      printf '%s\\n' $global_flags
    else
      printf '%s\\n' $top_cmds
    end
  else if string match -q -- '-*' $cur
    printf '%s\\n' $global_flags
  end
end

complete -c gitflic -f -a '(__gitflic_complete)'
`;

export const usage = `Shell completion:
  completion bash                                  Print bash completion script
  completion zsh                                   Print zsh completion script
  completion fish                                  Print fish completion script

Install with:
  bash:  eval "$(gitflic completion bash)"
  zsh:   gitflic completion zsh > "\${fpath[1]}/_gitflic"
  fish:  gitflic completion fish > ~/.config/fish/completions/gitflic.fish
`;

export async function handle(_ctx, sub, _args, _flags) {
  switch (sub) {
    case "bash":
      process.stdout.write(BASH);
      return;
    case "zsh":
      process.stdout.write(ZSH);
      return;
    case "fish":
      process.stdout.write(FISH);
      return;
    default:
      process.stderr.write(
        `gitflic: completion: unknown shell '${sub}'. Use bash | zsh | fish.\n`,
      );
      process.exit(2);
  }
}
