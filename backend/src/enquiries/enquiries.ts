import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { clean, EMAIL, PHONE } from '../onboarding/helpers';

export type EnquiryInput = {
  name?: string;
  organisation?: string;
  phone?: string;
  email?: string;
  message?: string;
  /** Hidden field; people never fill it, simple bots do. */
  website?: string;
};

@Injectable()
export class EnquiriesService {
  constructor(private readonly dataSource: DataSource) {}

  async create(input: EnquiryInput) {
    if (clean(input.website)) return { received: true };
    const name = clean(input.name);
    const organisation = clean(input.organisation);
    const phone = clean(input.phone);
    const email = clean(input.email)?.toLowerCase() ?? null;
    const message = clean(input.message);
    if (!name || name.length > 100) throw new BadRequestException('Enter your name (up to 100 characters).');
    if (organisation && organisation.length > 150) throw new BadRequestException('Company name is too long.');
    if (!phone && !email) throw new BadRequestException('Give a phone number or an email so we can reply.');
    if (phone && !PHONE.test(phone)) throw new BadRequestException('Phone number must be 6 to 19 digits, optionally starting with +.');
    if (email && (!EMAIL.test(email) || email.length > 255)) throw new BadRequestException('Enter a valid email address.');
    if (!message || message.length > 1000) throw new BadRequestException('Write a short message (up to 1000 characters).');

    // A light brake on floods: at most 30 enquiries an hour across the site.
    const [{ recent }] = await this.dataSource.query(
      `SELECT count(*)::int AS recent FROM enquiries WHERE "createdAt" > now() - interval '1 hour'`,
    );
    if (recent >= 30) {
      throw new HttpException('Too many messages right now. Please email nowonfmindia@gmail.com instead.', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.dataSource.query(
      `INSERT INTO enquiries (name, organisation, phone, email, message) VALUES ($1, $2, $3, $4, $5)`,
      [name, organisation, phone, email, message],
    );
    return { received: true };
  }

  list() {
    return this.dataSource.query(
      `SELECT id, kind, name, organisation, phone, email, message, status, "createdAt"
         FROM enquiries ORDER BY (status = 'new') DESC, "createdAt" DESC LIMIT 200`,
    );
  }

  async setStatus(id: string, status: unknown) {
    if (status !== 'new' && status !== 'done') throw new BadRequestException('Status must be new or done.');
    const rows = await this.dataSource.query(`UPDATE enquiries SET status = $2 WHERE id = $1 RETURNING id`, [id, status]);
    if (!rows.length) throw new NotFoundException('Enquiry not found.');
    return { id, status };
  }
}

/** Public: POST /enquiries from the Advertise page. */
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Post()
  create(@Body() body: EnquiryInput) {
    return this.enquiries.create(body ?? {});
  }
}

/** Super Admin: GET /admin/enquiries, PATCH /admin/enquiries/:id. */
@Controller('admin/enquiries')
@UseGuards(SuperadminGuard)
export class AdminEnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Get()
  list() {
    return this.enquiries.list();
  }

  @Patch(':id')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: string }) {
    return this.enquiries.setStatus(id, body?.status);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [EnquiriesController, AdminEnquiriesController],
  providers: [EnquiriesService],
})
export class EnquiriesModule {}
