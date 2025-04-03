module.exports = class Command {
  constructor(client, options) {
    this.client = client;
    this.name = options.name;
    this.usage = options.usage || 'No Usage';
    this.description = options.description || 'N/A';
    this.aliases = options.aliases || 'N/A';
    this.enabled = options.enabled;
    this.permissions = options.permissions || [];
    this.category = options.category || "member";
    this.slash = options.slash || false;
    this.options = options.options || [];
  }
};