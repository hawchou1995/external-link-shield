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

  // --- 文本 Getters ---
  get title() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  get disclaimerText() { return i18n(themePrefix("secure_links.leaving_confirmation_disclaimer")); }
  get questionText() { return i18n(themePrefix("secure_links.leaving_confirmation_question")); }
  get destinationText() { return i18n(themePrefix("secure_links.leaving_confirmation_destination")); }
  get dangerousWarningText() { return i18n(themePrefix("secure_links.dangerous_warning")); }
  get riskyWarningText() { return i18n(themePrefix("secure_links.risky_warning")); }
  get reportHintText() { return i18n(themePrefix("secure_links.leaving_confirmation_report_hint")); }
  
  // 按钮文本
  get copyUrlLabel() { return i18n(themePrefix("secure_links.copy_url")); }
  get continueLabel() { return i18n(themePrefix("secure_links.continue")); }
  get cancelLabel() { return i18n("cancel"); } // 使用 Discourse 核心自带的取消翻译

  // --- 样式与图标 ---
  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt";
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
          
          {{!-- 1. 顶部图标 (图标样式交由 CSS 控制，这里只负责渲染结构) --}}
          <div class="modal-icon-wrapper {{this.level}}">
             {{dIcon this.titleIcon}}
          </div>

          {{!-- 2. 普通外链的免责声明 --}}
          {{#if this.isNormal}}
            <p class="disclaimer-text">
              {{this.disclaimerText}}
            </p>
          {{/if}}

          {{!-- 3. 核心提示文本 --}}
          <div class="main-alert-text">
            {{#if this.isDangerous}}
              <div class="alert-box dangerous">
                {{this.dangerousWarningText}}
              </div>
            {{/if}}
            
            {{#if this.isRisky}}
              <div class="alert-box risky">
                {{this.riskyWarningText}}
              </div>
            {{/if}}

            {{#if this.isNormal}}
               <span class="confirm-question">{{this.questionText}}</span>
               <div class="redirect-hint">
                 {{this.destinationText}}
               </div>
            {{/if}}
          </div>

          {{!-- 4. URL 胶囊 --}}
          <div class="url-preview">
            {{@model.url}}
          </div>

          {{!-- 5. 举报提示 --}}
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
          @translatedLabel={{this.cancelLabel}} 
          @action={{@closeModal}}
          class="btn-flat"
        />

        {{#if this.isDangerous}}
          <DButton
            @translatedLabel={{this.copyUrlLabel}}
            @action={{this.copyUrl}}
            @icon="copy"
            class="btn-danger"
          />
        {{else}}
          <DButton
            @translatedLabel={{this.continueLabel}}
            @action={{this.proceed}}
            @icon="arrow-right"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}
      </:footer>
    </DModal>
  </template>
}
