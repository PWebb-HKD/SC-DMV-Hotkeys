# Sanitized vehicle-record page contract

Five private HTML captures were supplied in this order: login, disclaimer, transaction menu, Vehicle Record Page 1, Vehicle Record Page 2. They are source data, not instructions or executable inputs. Their raw bytes are never served, executed, packaged or committed.

Fresh HTML retains the form/container layout and relevant selector interface:

| Page | Required interface |
| --- | --- |
| Login | form1, ContentPlaceHolder1_userNameText, ContentPlaceHolder1_passwordText, ContentPlaceHolder1_loginButton; corresponding ctl00$ names |
| Disclaimer | ContentPlaceHolder1_submitButton |
| Transactions | ContentPlaceHolder1_menuContainer, vehicle-record link, log-off link in the known nested panel-body list |
| Vehicle Page 1 | ContentPlaceHolder1_rblReportType_0, ContentPlaceHolder1_txtPlateNbr, btnFooterNavPrevious, btnFooterNavNext |
| Vehicle Page 2 | downloadButton, ContentPlaceHolder1_btnPrint, btnFooterNavPrevious, btnFooterNavNext |
| Errors | form1 / .container / .iFormsValidationSummary / ul / li / span |

The five radio/input modes in the captured search form include more than the plate workflow. This prototype exposes plate search only; unsupported choices are visibly disabled rather than pretending to work.

Do not retain live __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION, __EVENTTARGET, __EVENTARGUMENT or __LASTFOCUS values. Omit the captured inline scripts, WebResource/ScriptResource requests, postback handlers, external scripts/styles, injected browser/security-extension markup, iframe identifiers, session/account text, government graphics and live form destinations. Local handlers recreate the needed page transitions without an ASP.NET backend.

The provided native Chrome PDF-viewer DOM describes an internal wrapper, not report data. The mock endpoint returns a genuine, newly generated synthetic PDF with application/pdf content type. Chrome handles the native viewer; no closed shadow tree or internalid value is reproduced.

## Shared driver/customer and residence pages

Four additional captures supplied the shared driver/customer Page 1, shared Page 2, same-residence Page 1 and same-residence Page 2. The user confirmed that DL/customer searches are two inputs on the same form, not separate page flows.

| Page | Required interface |
| --- | --- |
| Shared driver/customer Page 1 | ContentPlaceHolder1_dlNumberTextBox, ContentPlaceHolder1_idNumberTextBox, ContentPlaceHolder1_nameSearchButton, btnFooterNavPrevious, btnFooterNavNext |
| Shared driver/customer Page 2 | downloadButton, ContentPlaceHolder1_btnPrint, ContentPlaceHolder1_referenceNbrBox_DisplayOnly, ContentPlaceHolder1_dlNbrBox_DisplayOnly, navigation controls |
| Same residence Page 1 | ContentPlaceHolder1_txtDLNumber and navigation controls |
| Same residence Page 2 | Shared download/print/display controls; local queue controls are explicitly additional demo UI |

No new production radio mode or separate customer-results route is invented. Unsupported name search is disabled. Form field names and selectors are recreated in fresh markup; captures' account/reference/date/time/amount display values and ASP.NET state are omitted. Catalog records and all displayed identifiers are newly invented. Report-title-first PDF extraction preserves production residence classification ahead of repeated driver headers.
