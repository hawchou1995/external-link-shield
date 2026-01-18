import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import dIcon from "discourse-common/helpers/d-icon";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  // --- 状态判断 ---
  get level() { return this.args.model.securityLevel; }
  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }
  get isNormal() { return !this.isDangerous && !this.isRisky; }

  // --- 文本 Getters (解决严格模式下 themePrefix 无法在模板中使用的问题) ---
  get title() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  get disclaimerText() {
    return i18n(themePrefix("secure_links.leaving_confirmation_disclaimer"));
  }

  get questionText() {
    return i18n(themePrefix("secure_links.leaving_confirmation_question"));
  }

  get destinationText() {
    return i18n(themePrefix("secure_links.leaving_confirmation_destination"));
  }

  get dangerousWarningText() {
    return i18n(themePrefix("secure_links.dangerous_warning"));
  }

  get riskyWarningText() {
    return i18n(themePrefix("secure_links.risky_warning"));
  }

  get reportHintText() {
    return i18n(themePrefix("secure_links.leaving_confirmation_report_hint"));
  }

  get copyUrlLabel() {
    return i18n(themePrefix("secure_links.copy_url"));
  }

  get continueLabel() {
    return i18n(themePrefix("secure_links.continue"));
  }

  // --- 样式与图标 ---
  get iconColor() {
     if (this.isDangerous) return "#FF3B30"; // Red
     if (this.isRisky) return "#FF9500";     // Orange
     return "#007AFF";                       // Blue
  }

  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt";
  }

  get iconStyle() {
    return `font-size: 2.5em; color: ${this.iconColor};`;
  }

  // --- 动作 ---
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
        <div class="modal-body-container">
          
          {{!-- 1. 顶部图标 --}}
          <div class="modal-icon-wrapper">
             {{dIcon this.titleIcon style=this.iconStyle}}
          </div>

          {{!-- 2. 普通外链的免责声明 (仅 Normal 显示) --}}
          {{#if this.isNormal}}
            <p class="disclaimer-text">
              {{this.disclaimerText}}
            </p>
          {{/if}}

          {{!-- 3. 核心提示文本 --}}
          <div class="main-alert-text">
            {{#if this.isDangerous}}
              {{this.dangerousWarningText}}
            {{else if this.isRisky}}
              {{this.riskyWarningText}}
            {{else}}
               <span class="confirm-question">{{this.questionText}}</span>
               <div class="redirect-hint">
                 {{this.destinationText}}
                 {{dIcon "arrow-down"}}
               </div>
            {{/if}}
          </div>

          {{!-- 4. URL 胶囊 --}}
          <div class="url-preview">
            {{@model.url}}
          </div>

          {{!-- 5. 举报提示 (使用 unless 替代 not) --}}
          {{#unless this.isDangerous}}
            <div class="report-hint-box">
              {{dIcon "flag"}}
              <span>{{this.reportHintText}}</span>
            </div>
          {{/unless}}

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
            @label={{this.copyUrlLabel}}
            @action={{this.copyUrl}}
            @icon="copy"
            class="btn-danger"
          />
        {{else}}
          <DButton
            @label={{this.continueLabel}}
            @action={{this.proceed}}
            @icon="arrow-right"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}
      </:footer>
    </DModal>
  </template>
}
