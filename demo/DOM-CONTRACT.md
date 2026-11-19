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

## SCUTTIES search, results and citation display

Three additional private captures show the post-login search, populated results and a selected citation display. These are Angular view states in one document, including inactive data-entry/help-desk/admin forms. The demo uses fresh local markup/handlers rather than executing the captured Angular app, scripts or service endpoints. It omits inactive workflows, live code tables, account/agency/officer data, dynamic uiGrid IDs and all captured person/citation values. Only one home ID is emitted; the source also contains a hidden help-desk container with that duplicate ID.

| View | Retained interface |
| --- | --- |
| Menu handoff | /SCTRNS/Member/Transactions/SCUTTIES/SCUTTIES.aspx, opened in a named child tab |
| Search | #home and its nested third panel; searchData.violatorLastName and searchData.violatorBirthDate inputs; dobSearchDTM name |
| Actions | searchCitation(), searchCitationSaved(), clearSearch() binding attributes; Search first, disabled Show SAVED Citations second, Clear third |
| Results | Citation Number, Violator Name, Birth Date, DL Number, State, Violation Date, Statute, Disp; View uses grid.appScope.gridRowView(row.entity.CitationNumber) as a compatibility attribute |
| Detail | #display, showHome() and printCitationDisplay() attributes; read-only, fictional citation/violator/vehicle/court/officer/location sections |

The search destination Search.aspx is a local fixture route, not a URL established by the supplied DOM. Handoff timing/wording and no-results wording are also demo-defined; no real sign-in exchange is simulated at the token/network level. Results use an accessible HTML table in a horizontally scrollable region instead of shipping the third-party Angular grid. Binding attributes are inert compatibility markers, not executed expressions.

Known production mismatch: extension/automation.js SC_SEARCH selects button:nth-child(2), whereas the captures place searchCitation() first and searchCitationSaved() second. The demo intentionally retains the capture's action order. Correcting production selection belongs to the subsequent versioned extension work; origin boundaries and installed-extension behavior are unchanged here.

## Synthetic image and recovery fixtures

Photo/no-photo raster fixtures are procedural, not taken from the private captures or uploaded PDFs. A first-page Image XObject supplies a fictional portrait or the standard placeholder's non-personal text-mask layout. Production PDF.js, extractDriverIdentity and isNoPhotoPlaceholder process the actual PDF; no fabricated identity payload bypasses the extractor. The mask fixture deliberately exercises the existing known signature and is not independent evidence about detection of other graphics. The demo identity checkbox is extra local UI, with its own session preference and no installed-extension storage access.

Session-expiration, delayed/timed-out search and service-error controls are additional demo UI. Their timing, messages and behavior are defined here, not captured from the live site. The ErrorPage.aspx fixture returns HTTP 503 with ContentPlaceHolder1_errorMessagePublicText; failed PDF requests return HTTP 503 text rather than a valid document. Ready controls remain hidden during pending/failed searches, and result/queue state is committed only after successful completion. These states do not authorize changes to production retry behavior or origin recognition.
