import mongoose, { Schema } from 'mongoose';

// Facilities
const FacilitySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    iconName: { type: String },
    image: { type: String },
    imageUrl: { type: String },
    imageFileKey: { type: String },
    features: [{ type: String }],
    displayOrder: { type: Number, default: 0 },
    status: { type: String, default: 'ACTIVE' },
    isActive: { type: Boolean, default: true },
    category: { type: String },
    details: { type: String },
  },
  { timestamps: true, collection: 'facilities', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

// Gallery Items
const GalleryItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    category: { type: String, required: true, index: true },
    image: { type: String },
    imageUrl: { type: String },
    fileKey: { type: String },
    caption: { type: String },
    description: { type: String },
    eventDate: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String },
  },
  { timestamps: true, collection: 'gallery', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

// Hero Slides
const HeroSlideSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    description: { type: String },
    badge: { type: String },
    primaryCtaText: { type: String },
    primaryCtaAction: { type: String },
    secondaryCtaText: { type: String },
    secondaryCtaAction: { type: String },
    bgGradient: { type: String },
    image: { type: String },
    imageUrl: { type: String },
    desktopImage: { type: String },
    desktopImageFileKey: { type: String },
    mobileImage: { type: String },
    mobileImageFileKey: { type: String },
    fileKey: { type: String },
    ctaText: { type: String },
    ctaLink: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: { type: String },
    endDate: { type: String },
  },
  { timestamps: true, collection: 'hero_slides', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

// Leadership Profiles
const LeadershipProfileSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    role: { type: String },
    designation: { type: String, required: true },
    roleCategory: { type: String, default: 'PRINCIPAL' },
    qualification: { type: String },
    education: { type: String },
    experience: { type: String },
    responsibilities: { type: String },
    message: { type: String },
    fullBio: { type: String },
    shortBio: { type: String },
    quote: { type: String },
    photo: { type: String },
    photoUrl: { type: String },
    photoFileKey: { type: String },
    imageUrl: { type: String },
    fileKey: { type: String },
    email: { type: String },
    phone: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    showOnWebsite: { type: Boolean, default: true },
    showProfile: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'leadership', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

// Events
const WebsiteEventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    eventDate: { type: String },
    startDate: { type: String },
    endDate: { type: String },
    date: { type: String },
    time: { type: String },
    location: { type: String },
    venue: { type: String },
    category: { type: String, default: 'Celebration' },
    image: { type: String },
    imageUrl: { type: String },
    imageFileKey: { type: String },
    fileKey: { type: String },
    displayOrder: { type: Number, default: 0 },
    isUpcoming: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'website_events', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

// Admission Enquiries
const AdmissionEnquirySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    referenceNumber: { type: String, index: true },
    parentName: { type: String, required: true },
    studentName: { type: String, required: true },
    mobile: { type: String },
    phone: { type: String },
    email: { type: String },
    classApplying: { type: String },
    classSeeking: { type: String },
    currentSchool: { type: String },
    message: { type: String },
    status: {
      type: String,
      default: 'SUBMITTED',
      index: true,
    },
    notes: { type: String },
    submittedAt: { type: String, required: true },
    updatedAt: { type: String },
  },
  { timestamps: true, collection: 'admission_enquiries', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

// Website Content
const WebsiteContentSchema = new Schema(
  {
    singleRecord: { type: Boolean, default: true, unique: true },
    aboutSchool: { type: String },
    aboutHighlights: [{ title: { type: String }, desc: { type: String } }],
    vision: { type: String },
    visionStatement: { type: String },
    visionPoints: [{ type: String }],
    mission: { type: String },
    missionStatement: { type: String },
    missionPoints: [{ type: String }],
    principalDeskMessage: { type: String },
    principalMessage: { type: String },
    chairmanMessage: { type: String },
    academicIntro: { type: String },
    academicsOverview: { type: String },
    residentialLife: { type: String },
    hostelOverview: { type: String },
    campusIntro: { type: String },
    admissionGuidelines: { type: String },
    contactInfo: { type: Schema.Types.Mixed },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String },
  },
  { timestamps: true, collection: 'website_content', strict: false, bufferCommands: false, bufferTimeoutMS: 0 }
);

export const FacilityModel: mongoose.Model<any> =
  mongoose.models.Facility || mongoose.model('Facility', FacilitySchema);
export const GalleryItemModel: mongoose.Model<any> =
  mongoose.models.GalleryItem || mongoose.model('GalleryItem', GalleryItemSchema);
export const HeroSlideModel: mongoose.Model<any> =
  mongoose.models.HeroSlide || mongoose.model('HeroSlide', HeroSlideSchema);
export const LeadershipProfileModel: mongoose.Model<any> =
  mongoose.models.LeadershipProfile || mongoose.model('LeadershipProfile', LeadershipProfileSchema);
export const WebsiteEventModel: mongoose.Model<any> =
  mongoose.models.WebsiteEvent || mongoose.model('WebsiteEvent', WebsiteEventSchema);
export const AdmissionEnquiryModel: mongoose.Model<any> =
  mongoose.models.AdmissionEnquiry || mongoose.model('AdmissionEnquiry', AdmissionEnquirySchema);
export const WebsiteContentModel: mongoose.Model<any> =
  mongoose.models.WebsiteContent || mongoose.model('WebsiteContent', WebsiteContentSchema);
