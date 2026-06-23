class Gitflic < Formula
  desc "Zero-dependency CLI for the full GitFlic REST API (gitflic.ru)"
  homepage "https://cli-gitflic.ru"
  # Points at the immutable npm tarball. Bump `url` + `sha256` on every release
  # (scripts/publish.mjs --bump-formula does this for you after `npm publish`).
  url "https://registry.npmjs.org/gitflic-cli/-/gitflic-cli-0.3.1.tgz"
  # placeholder — `node scripts/publish.mjs --bump-formula` fills the real hash
  sha256 "96e8a2158a801c338d5425d83178b546a0e9968ef1cad4ee0fa63d3d5393103c"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "gitflic", shell_output("#{bin}/gitflic help")
  end
end
