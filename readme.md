(Enable word wrap in vs code)

===========
Signup:- ||
===========

The user get the signup page which has a form with different fields like email, password, confirm password, address, otp, etc (see below for all fields). There is also a get otp button which is disabled until the email field is not filled also make a email validation check before hitting the get otp button. Show users a message which tell them to fill all the fields before clicking get otp button as if they first get otp and then fill it may cause the otp to expire

Once the user has clicked the get otp button call the endpt: 'POST /auth/send-otp/:email' with no body. It'll send a mail to the email with the otp code which expires in 5 minutes

Once use fills all the fields along with otp send all the field info in the body and call the endpt: 'POST /auth/signup' the list of fields in the body include: email, password, confirmPassword, firstName, lastName, dob, address, phone, otp. If signup successful you'll get back reponse with statuscode 201 along with an authtoken (see endpoint code) which you've to store in local storage and on every request send it in "authorization" header in the format: 'Bearer <token>'. if signup not successful redirect user again to signup page

By default whenever a user signs up to our website he has the role of POLICY_HOLDER if we want we can manually change their role from our backend or we can let another user with role CLAIM_ASSESSOR upgrade them to claim assessor by hitting another endpt given below

==========
Login:- ||
==========

'POST /auth/login' in the body send email and password. On successful login you'll get auth token which you've to store in local storage and on every request send it in "authorization" header in the format: 'Bearer <token>'. if login not successful redirect user again to login page

========
User:-||
========

'GET /user/my-details': Currently logged in user gets to view their acc details along with their policies, claims and uploaded documents (just the info of documents and not the links of documents)

'GET /user/details/:userId': This can be only used by claim assessor and they can access users details and their documents, claims and policies

'DELETE /user/delete-account': Used to delete the acc of currently logged in user. This is a sensitive endpoint so its mandatory for users to enter their passwords to make this req. Body must include field password 

'PUT /user/promote-to-claim-assessor/:userId': Used to promote another to the role CLAIM_ASSESSOR and can be accessed only by one claim assessor by passing their userid to url

'GET /policy/:id': Get a policy with id passed into url includes list of claim ids attached to it and user who owns it

'GET /policy/list/:userId': Get list policies owned by a user. Pass his userId in url params

'POST /policy/new': create new policy only can be accessed by claim assessor. Body must include fields like: hospName, hospCity, desc, userId

'DELETE /policy/delete/:id': delete policy with its id passed in url params only can be accessed by claim assessor

=========
Claim:-||
=========

'GET /claim/my-claims': get all the claims of logged in user included with report and documents attached to it

'GET /claim/:id': get claim with a specific claim id included with report and documents attached to it

'GET /claim/user/:userId': get claim with a specific claim id included with report and documents attached to it

'POST /claim/new': make new claim for logged in user, only POLICY_HOLDER can make claims. body should contain fields claimAmount, claimType, dateOfIntimation, desc, policyId

'PUT /claim/update/:id': update claim with its id passed in url params only POLICY_HOLDER can update claims. body should contain fields claimAmount, claimType, desc

'DELETE /claim/delete/:id': delete claim with its id passed in url params only POLICY_HOLDER can delete claims

============
Document:-||
============

"GET /document/:id": get back the document details along with url to access it 

"GET /document/count/:claimId": gives back number of documents for the claim whose id is passed in url params. Use this in frontend before uploading to count number of docs uploaded for a claim and if 
docs after upload is more than 15 discard upload

"GET /document/:claimId": get back all docs along with their urls to access them which are attached to a claim with its claimId passed in req params

"POST /document/upload/:claimId": upload a max of 15 files. Will get discard if number of docs uploaded and existing docs exceed 15.

"POST /document/upload/one/:claimId": upload one file with get discarded if already 15 docs uploaded for given claim

"DELETE /document/delete/:id": only for policy holder delete document and related s3 object by its id

"DELETE /document/delete/:claimId": only for policy holder delete documents and related s3 object by claim id

==========
Report:-||
==========

"GET /report/generate/:claimId": only for claim assessor for a claim

"GET /report/:claimId": get report by its claim

"PUT /report/update/:claimId": update parts of report. fields must include combinedSummary, estimatedExpenses, notes, approved

"PUT /report/treaments/update/:reportId":  update treaments part of report. fields include text (which is the json with structure given in prompts document)

"PUT /report/docWise/update/:reportId": update docwise report part of report and fields include text (which is the list of json with structure given in prompts document)

"DELETE /report/delete/:claimId": only for claim assessor

