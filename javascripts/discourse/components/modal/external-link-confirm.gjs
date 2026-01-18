import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import dIcon from "discourse-common/helpers/d-icon";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  get level() {
    return this.args.model.securityLevel;
  }

  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }

  get title() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt";
  }

  // 计算图标颜色
  get iconColor() {
     if (this.isDangerous) return "#FF3B30"; // iOS Red
     if (this.isRisky) return "#FF9500";     // iOS Orange
     return "#007AFF";                       // iOS Blue
  }

  // ✨ 修复核心：在 JS 中拼接样式，替代模板中的 concat
  get iconStyle() {
    return `font-size: 3.5em; color: ${this.iconColor};`;
  }

  @action
  proceed() {
    const { url, openInNewTab } = this.args.model;
    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
    this.args.closeModal();
  }

  @action
  copyUrl() {
    navigator.clipboard.writeText(this.args.model.url).then(() => {
       this.toaster.show(i18n(themePrefix("secure_links.copied")), { type: 'success' });
    });
  }

  <template>
    <DModal @title={{this.title}} @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      <:body>
        {{!-- 大图标区域 --}}
        <div class="modal-icon-wrapper">
           {{!-- 修复：直接使用 this.iconStyle --}}
           {{dIcon this.titleIcon style=this.iconStyle}}
        </div>

        <p>
          {{#if this.isDangerous}}
            {{i18n (themePrefix "secure_links.dangerous_warning")}}
          {{else if this.isRisky}}
            {{i18n (themePrefix "secure_links.risky_warning")}}
          {{else}}
            {{i18n (themePrefix "secure_links.leaving_confirmation_description_first")}}
          {{/if}}
        </p>

        <div class="url-preview">
          {{@model.url}}
        </div>
      </:body>

      <:footer>
        <DButton
          @label="cancel"
          @action={{@closeModal}}
          class="btn-flat"
        />

        {{#if this.isDangerous}}
          <DButton
            @label={{themePrefix "secure_links.copy_url"}}
            @action={{this.copyUrl}}
            @icon="copy"
            class="btn-danger"
          />
        {{else}}
          <DButton
            @label={{themePrefix "secure_links.continue"}}
            @action={{this.proceed}}
            @icon="arrow-right"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}
      </:footer>
    </DModal>
  </template>
}
