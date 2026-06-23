class Gitflic < Formula
  desc "Zero-dependency CLI for the full GitFlic REST API (gitflic.ru)"
  homepage "https://cli-gitflic.ru"
  # Points at the immutable npm tarball. Bump `url` + `sha256` on every release
  # (scripts/publish.mjs --bump-formula does this for you after `npm publish`).
  url "https://registry.npmjs.org/gitflic-cli/-/gitflic-cli-0.3.2.tgz"
  # placeholder — `node scripts/publish.mjs --bump-formula` fills the real hash
  sha256 "6705315f12888951a89d9d4ce7e230a067c5d678b6f5be9ad5233125a934e486"
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
